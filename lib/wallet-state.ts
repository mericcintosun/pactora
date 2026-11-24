// Wallet and transaction lifecycle shared by CampaignRoom and BatchWorkspace.
// Client side only in practice (it touches window.ethereum), but it holds no secret
// and imports nothing server only. The injected EIP-1193 provider is used in live
// mode only; practice mode maps onto the same states with a seeded demo wallet as
// the connected account, so the demo path never shows a wallet or faucet screen.
import {
  BaseError,
  createWalletClient,
  custom,
  keccak256,
  stringToBytes,
  UserRejectedRequestError,
  type Address,
  type Hex,
} from "viem";
import { aevumTestnet } from "@/lib/aevum";
import { AEVUM_CHAIN_ID } from "@/lib/config";
import type { ErrorCode } from "@/lib/errors";

export { AEVUM_CHAIN_ID };

/** What the pending or finished transaction was for. "connect" is the account request itself. */
export type TxAction = "connect" | "pledge" | "cancel" | "settle" | "create";

/**
 * Eight states, one per thing the person at the screen needs to know.
 * `practice` is true when the account is the seeded demo wallet and nothing goes to Aevum.
 */
export type WalletState =
  | { kind: "disconnected" }
  | { kind: "connecting" }
  | { kind: "wrong-network"; account: Address; chainId: number }
  | { kind: "idle"; account: Address; practice: boolean }
  | { kind: "tx-pending"; account: Address | null; practice: boolean; action: TxAction; label: string }
  | { kind: "tx-confirmed"; account: Address | null; practice: boolean; action: TxAction; txHash: Hex; mock: boolean }
  | { kind: "tx-rejected"; account: Address | null; practice: boolean; action: TxAction }
  | { kind: "tx-failed"; account: Address | null; practice: boolean; action: TxAction; code: TxErrorCode; hint: string };

/** Codes from /api/relay plus one the browser raises itself. */
export type TxErrorCode = ErrorCode | "wallet_missing";

/** A failure with a known code and a plain one-sentence hint (never provider text). */
export class TxError extends Error {
  readonly code: TxErrorCode;
  readonly hint: string;
  constructor(code: TxErrorCode, hint: string) {
    super(hint);
    this.name = "TxError";
    this.code = code;
    this.hint = hint;
  }
}

/** The account the state is about, if any. */
export function accountOf(state: WalletState): Address | null {
  switch (state.kind) {
    case "disconnected":
    case "connecting":
      return null;
    default:
      return state.account;
  }
}

/** Submit controls bind `disabled` to this, never to a timer. */
export function isBusy(state: WalletState): boolean {
  return state.kind === "tx-pending" || state.kind === "connecting";
}

function hasRejectCode(x: unknown): boolean {
  if (typeof x !== "object" || x === null) return false;
  const code = (x as { code?: unknown }).code;
  if (code === 4001 || code === UserRejectedRequestError.code) return true;
  return hasRejectCode((x as { cause?: unknown }).cause);
}

/**
 * Pure. "rejected" when the person closed or declined the wallet prompt (EIP-1193 code
 * 4001 or viem UserRejectedRequestError); everything else, a revert or an RPC error, is "failed".
 */
export function classifyError(err: unknown): "rejected" | "failed" {
  if (err instanceof UserRejectedRequestError) return "rejected";
  if (err instanceof BaseError && err.walk((e) => e instanceof UserRejectedRequestError) instanceof UserRejectedRequestError) {
    return "rejected";
  }
  if (err instanceof Error && err.name === "UserRejectedRequestError") return "rejected";
  return hasRejectCode(err) ? "rejected" : "failed";
}

/** Map any thrown value onto tx-rejected or tx-failed. */
export function failureState(
  err: unknown,
  ctx: { action: TxAction; account: Address | null; practice: boolean },
): WalletState {
  if (classifyError(err) === "rejected") return { kind: "tx-rejected", ...ctx };
  if (err instanceof TxError) return { kind: "tx-failed", ...ctx, code: err.code, hint: err.hint };
  return { kind: "tx-failed", ...ctx, code: "upstream_error", hint: "" };
}

/**
 * Idempotency key for /api/relay, built from action:poolId:buyer:nonce. The parts are
 * hashed so the key stays between 16 and 80 characters whatever the nonce length.
 * Practice calls pass a per-click counter as the nonce.
 */
export function idempotencyKey(action: TxAction, poolId: number, buyer: string, nonce: string): string {
  const digest = keccak256(stringToBytes(`${action}:${poolId}:${buyer.toLowerCase()}:${nonce}`));
  return `${action}-${poolId}-${digest.slice(2, 42)}`;
}

// ------------------------------------------------------------------ injected wallet

/** The minimal EIP-1193 surface this app calls. */
export type InjectedProvider = { request(args: { method: string; params?: unknown }): Promise<unknown> };

/** The browser wallet, if one is installed. The one copy of this lookup in the app. */
export function injected(): InjectedProvider | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { ethereum?: InjectedProvider }).ethereum;
}

/** Ask the wallet for an account and report which chain it is on. */
export async function connectInjected(): Promise<{ account: Address; chainId: number }> {
  const eth = injected();
  if (!eth) throw new TxError("wallet_missing", "No browser wallet was found. Open one that can join Aevum testnet.");
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[] | undefined;
  const account = accounts?.[0];
  if (!account) throw new TxError("wallet_missing", "The wallet did not share an account.");
  const chainHex = (await eth.request({ method: "eth_chainId" })) as string;
  return { account: account as Address, chainId: Number(BigInt(chainHex)) };
}

/** A viem wallet client over the injected provider, for typed-data signatures and seller writes. */
export function walletClient() {
  const eth = injected();
  if (!eth) throw new TxError("wallet_missing", "No browser wallet was found. Open one that can join Aevum testnet.");
  return createWalletClient({ chain: aevumTestnet, transport: custom(eth) });
}
