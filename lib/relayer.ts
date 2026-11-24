// Server only: the gasless relayer. It holds the only secret in the app,
// RELAYER_PRIVATE_KEY, read lazily inside readKey() and nowhere else. No "use client"
// file imports this module; app/api/relay/route.ts and lib/adapter/real.ts do.
//
// Every RPC call and every receipt wait goes through withTimeoutAndRetry. Transactions
// are legacy (gasPrice set), as Aevum requires.
import {
  createWalletClient,
  formatUnits,
  parseEventLogs,
  parseSignature,
  type Address,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { aevumTestnet, aevumTransport, publicClient, quorumPoolAbi, tusd8Abi } from "./aevum";
import {
  POOL_ADDRESS,
  RECEIPT_TIMEOUT_MS,
  RELAYER_KEY_ENV,
  TUSD8_ADDRESS,
  TUSD8_DECIMALS,
} from "./config";
import { apiError, REVERT_HINTS, type ApiError } from "./errors";
import { CallError, toCallError, withTimeoutAndRetry } from "./http";
import { log, since } from "./log";
import type { SettleTransfer } from "./types";

export interface RelayResult {
  txHash: Hex;
  /** settle: every tUSD8 Transfer in the receipt */
  transfers?: SettleTransfer[];
  /** settle: total forwarded to the seller, whole tUSD8 */
  sellerTotal?: number;
  /** createPool: the new pool id */
  poolId?: number;
}

function readKey(): Hex | null {
  const raw = process.env.RELAYER_PRIVATE_KEY;
  if (!raw) return null;
  const key = raw.startsWith("0x") ? raw : `0x${raw}`;
  return /^0x[0-9a-fA-F]{64}$/.test(key) ? (key as Hex) : null;
}

/** True when both the pool address and a well-formed relayer key are present. */
export function relayerConfigured(): boolean {
  return Boolean(POOL_ADDRESS) && readKey() !== null;
}

function relayerWallet() {
  const key = readKey();
  if (!key || !POOL_ADDRESS) {
    throw new CallError("not_configured", `Live relaying needs ${RELAYER_KEY_ENV} and NEXT_PUBLIC_CONTRACT_ADDRESS on the server.`);
  }
  return createWalletClient({
    account: privateKeyToAccount(key),
    chain: aevumTestnet,
    transport: aevumTransport(),
  });
}

function splitSig(signature: Hex) {
  const { r, s, v, yParity } = parseSignature(signature);
  return { r, s, v: v !== undefined ? Number(v) : yParity + 27 };
}

type Ids = Record<string, string | number>;

/** Legacy tx: read gasPrice, send, wait for the receipt. Throws CallError("reverted") on a failed receipt. */
async function sendAndWait(step: string, ids: Ids, write: (gasPrice: bigint) => Promise<Hex>): Promise<TransactionReceipt> {
  const t0 = Date.now();
  const gasPrice = await withTimeoutAndRetry(() => publicClient.getGasPrice());
  const hash = await withTimeoutAndRetry(() => write(gasPrice));
  log(`${step}.sent`, { ...ids, tx: hash, ms: since(t0) });
  const receipt = await withTimeoutAndRetry(
    () => publicClient.waitForTransactionReceipt({ hash, timeout: RECEIPT_TIMEOUT_MS }),
    { timeoutMs: RECEIPT_TIMEOUT_MS + 5_000 },
  );
  if (receipt.status !== "success") {
    log(`${step}.reverted`, { ...ids, tx: hash, ms: since(t0) });
    throw new CallError("reverted");
  }
  log(`${step}.mined`, { ...ids, tx: hash, block: receipt.blockNumber, ms: since(t0) });
  return receipt;
}

function fail(step: string, ids: Ids, err: unknown): ApiError {
  const e = toCallError(err);
  log(`${step}.failed`, { ...ids, code: e.code });
  return e.toApiError();
}

/** Cheap pre-check for pledge and cancel: is the buyer active, which nonce is live, is it used. */
async function buyerState(poolId: bigint, buyer: Address) {
  const [pledged, nonce] = await withTimeoutAndRetry(() =>
    publicClient.multicall({
      allowFailure: false,
      contracts: [
        { address: POOL_ADDRESS!, abi: quorumPoolAbi, functionName: "isPledged", args: [poolId, buyer] },
        { address: POOL_ADDRESS!, abi: quorumPoolAbi, functionName: "nonceFor", args: [poolId, buyer] },
      ],
    }),
  );
  const used = await withTimeoutAndRetry(() =>
    publicClient.readContract({ address: TUSD8_ADDRESS, abi: tusd8Abi, functionName: "authorizationState", args: [buyer, nonce] }),
  );
  return { pledged, nonce, used };
}

export async function submitPledge(input: { poolId: number; buyer: string; signature: string }): Promise<RelayResult | ApiError> {
  const ids = { poolId: input.poolId, buyer: input.buyer };
  try {
    const wallet = relayerWallet();
    const poolId = BigInt(input.poolId);
    const buyer = input.buyer as Address;
    const state = await buyerState(poolId, buyer);
    if (state.pledged) return apiError("invalid_input", REVERT_HINTS.AlreadyPledged);
    if (state.used) return apiError("invalid_input", REVERT_HINTS.NonceUsed);
    const { v, r, s } = splitSig(input.signature as Hex);
    const receipt = await sendAndWait("pledge", ids, (gasPrice) =>
      wallet.writeContract({
        address: POOL_ADDRESS!, abi: quorumPoolAbi, functionName: "pledge",
        args: [poolId, buyer, BigInt(0), v, r, s], gasPrice,
      }),
    );
    return { txHash: receipt.transactionHash };
  } catch (err) {
    return fail("pledge", ids, err);
  }
}

/** Withdraw: submit the buyer's CancelAuthorization to tUSD8 (skipped if already used), then withdrawPledge. */
export async function submitCancel(input: {
  poolId: number;
  buyer: string;
  nonce: string;
  signature: string;
}): Promise<RelayResult | ApiError> {
  const ids = { poolId: input.poolId, buyer: input.buyer };
  try {
    const wallet = relayerWallet();
    const poolId = BigInt(input.poolId);
    const buyer = input.buyer as Address;
    const state = await buyerState(poolId, buyer);
    if (!state.pledged) return apiError("invalid_input", REVERT_HINTS.NotPledged);
    if (state.nonce.toLowerCase() !== input.nonce.toLowerCase()) {
      return apiError("invalid_input", "That cancellation names a different nonce than this wallet's live signature.");
    }
    if (!state.used) {
      const { v, r, s } = splitSig(input.signature as Hex);
      await sendAndWait("cancel.token", ids, (gasPrice) =>
        wallet.writeContract({
          address: TUSD8_ADDRESS, abi: tusd8Abi, functionName: "cancelAuthorization",
          args: [buyer, state.nonce, v, r, s], gasPrice,
        }),
      );
    }
    const receipt = await sendAndWait("cancel.pool", ids, (gasPrice) =>
      wallet.writeContract({
        address: POOL_ADDRESS!, abi: quorumPoolAbi, functionName: "withdrawPledge", args: [poolId, buyer], gasPrice,
      }),
    );
    return { txHash: receipt.transactionHash };
  } catch (err) {
    return fail("cancel", ids, err);
  }
}

/** Collect: one settle tx. The receipt's tUSD8 Transfer logs become the on-screen receipt. */
export async function submitSettle(input: { poolId: number }): Promise<RelayResult | ApiError> {
  const ids = { poolId: input.poolId };
  try {
    const wallet = relayerWallet();
    const poolId = BigInt(input.poolId);
    const receipt = await sendAndWait("settle", ids, (gasPrice) =>
      wallet.writeContract({ address: POOL_ADDRESS!, abi: quorumPoolAbi, functionName: "settle", args: [poolId], gasPrice }),
    );
    const token = TUSD8_ADDRESS.toLowerCase();
    const transfers: SettleTransfer[] = parseEventLogs({ abi: tusd8Abi, eventName: "Transfer", logs: receipt.logs })
      .filter((l) => l.address.toLowerCase() === token)
      .map((l) => ({ from: l.args.from, to: l.args.to, amount: Number(formatUnits(l.args.value, TUSD8_DECIMALS)) }));
    const settled = parseEventLogs({ abi: quorumPoolAbi, eventName: "Settled", logs: receipt.logs })[0];
    const sellerTotal = settled ? Number(formatUnits(settled.args.total, TUSD8_DECIMALS)) : undefined;
    log("settle.decoded", { ...ids, transfers: transfers.length, sellerTotal });
    return { txHash: receipt.transactionHash, transfers, sellerTotal };
  } catch (err) {
    return fail("settle", ids, err);
  }
}

/**
 * Open a pool from the relayer wallet. Known constraint (README): the relayer becomes
 * the seller, so payouts go to the relayer until Phase 3 has sellers sign createPool.
 */
export async function submitCreatePool(input: {
  title: string;
  price: bigint;
  minOrders: number;
  maxOrders: number;
  deadline: bigint;
}): Promise<RelayResult | ApiError> {
  const ids = { minOrders: input.minOrders, maxOrders: input.maxOrders };
  try {
    const wallet = relayerWallet();
    const receipt = await sendAndWait("createPool", ids, (gasPrice) =>
      wallet.writeContract({
        address: POOL_ADDRESS!, abi: quorumPoolAbi, functionName: "createPool",
        args: [input.title, input.price, input.minOrders, input.maxOrders, input.deadline], gasPrice,
      }),
    );
    const created = parseEventLogs({ abi: quorumPoolAbi, eventName: "PoolCreated", logs: receipt.logs })[0];
    return { txHash: receipt.transactionHash, poolId: created ? Number(created.args.poolId) : undefined };
  } catch (err) {
    return fail("createPool", ids, err);
  }
}
