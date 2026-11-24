// Aevum testnet + tUSD8 integration: chain definition, ABIs, EIP-712 builders and
// live reads. Imported by client components, so it never touches a secret: every
// constant comes from lib/config.ts (NEXT_PUBLIC_ values only).
//
// Pages never call loadCampaign / listCampaigns directly: they go through
// getAdapter() in lib/adapter, and only the real adapter delegates here.
import {
  createPublicClient,
  defineChain,
  encodeAbiParameters,
  fallback,
  formatUnits,
  http,
  keccak256,
  parseEventLogs,
  type Address,
  type ContractFunctionParameters,
  type Hex,
} from "viem";
import { campaigns, getSeedCampaign } from "@/lib/data/seed";
import type { Campaign, Pledge, PledgeState } from "@/lib/types";
import {
  AEVUM_CHAIN_ID,
  AEVUM_RPC,
  AEVUM_RPC_FALLBACKS,
  CALL_TIMEOUT_MS,
  EXPLORER_URL,
  HISTORY_BUDGET_MS,
  LIVE_POOLS_ON_BOARD,
  LOG_LOOKBACK_BLOCKS,
  MULTICALL3,
  POOL_ADDRESS,
  TUSD8_ADDRESS,
  TUSD8_DECIMALS,
} from "./config";
import { withBudget, withTimeoutAndRetry } from "./http";
import { shortHex } from "./format";

export {
  AEVUM_CHAIN_ID,
  AEVUM_RPC,
  CALL_RETRIES,
  CALL_TIMEOUT_MS,
  EXPLORER_URL,
  MULTICALL3,
  POOL_ADDRESS,
  TUSD8_ADDRESS,
  TUSD8_DECIMALS,
} from "./config";

export const aevumTestnet = defineChain({
  id: AEVUM_CHAIN_ID,
  name: "Aevum Testnet",
  nativeCurrency: { name: "tQDAY", symbol: "tQDAY", decimals: 18 },
  rpcUrls: { default: { http: [AEVUM_RPC, ...AEVUM_RPC_FALLBACKS] } },
  blockExplorers: { default: { name: "Aevum Explorer", url: EXPLORER_URL } },
  contracts: { multicall3: { address: MULTICALL3 } },
});

/**
 * HTTP transport over AEVUM_RPC, then each NEXT_PUBLIC_AEVUM_RPC_FALLBACKS URL in order.
 * viem's own retries are off: withTimeoutAndRetry owns the single retry.
 */
export function aevumTransport() {
  const one = (url: string) => http(url, { timeout: CALL_TIMEOUT_MS, retryCount: 0 });
  if (AEVUM_RPC_FALLBACKS.length === 0) return one(AEVUM_RPC);
  return fallback([AEVUM_RPC, ...AEVUM_RPC_FALLBACKS].map(one), { rank: false, retryCount: 0 });
}

export const publicClient = createPublicClient({
  chain: aevumTestnet,
  transport: aevumTransport(),
});

export const quorumPoolAbi = [
  {
    type: "function", name: "pools", stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "seller", type: "address" }, { name: "deadline", type: "uint64" },
      { name: "minOrders", type: "uint32" }, { name: "maxOrders", type: "uint32" },
      { name: "settled", type: "bool" }, { name: "price", type: "uint256" }, { name: "title", type: "string" },
    ],
  },
  { type: "function", name: "poolCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "activeCount", stateMutability: "view", inputs: [{ name: "", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "entrantsOf", stateMutability: "view", inputs: [{ name: "poolId", type: "uint256" }], outputs: [{ type: "address[]" }] },
  { type: "function", name: "isPledged", stateMutability: "view", inputs: [{ name: "poolId", type: "uint256" }, { name: "buyer", type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "nonceFor", stateMutability: "view", inputs: [{ name: "poolId", type: "uint256" }, { name: "buyer", type: "address" }], outputs: [{ type: "bytes32" }] },
  {
    type: "function", name: "createPool", stateMutability: "nonpayable",
    inputs: [
      { name: "title", type: "string" }, { name: "price", type: "uint256" }, { name: "minOrders", type: "uint32" },
      { name: "maxOrders", type: "uint32" }, { name: "deadline", type: "uint64" },
    ],
    outputs: [{ name: "poolId", type: "uint256" }],
  },
  {
    type: "function", name: "pledge", stateMutability: "nonpayable",
    inputs: [
      { name: "poolId", type: "uint256" }, { name: "buyer", type: "address" }, { name: "validAfter", type: "uint256" },
      { name: "v", type: "uint8" }, { name: "r", type: "bytes32" }, { name: "s", type: "bytes32" },
    ],
    outputs: [],
  },
  { type: "function", name: "withdrawPledge", stateMutability: "nonpayable", inputs: [{ name: "poolId", type: "uint256" }, { name: "buyer", type: "address" }], outputs: [] },
  { type: "function", name: "dropPledge", stateMutability: "nonpayable", inputs: [{ name: "poolId", type: "uint256" }, { name: "buyer", type: "address" }], outputs: [] },
  { type: "function", name: "settle", stateMutability: "nonpayable", inputs: [{ name: "poolId", type: "uint256" }], outputs: [] },
  {
    type: "event", name: "PoolCreated",
    inputs: [
      { name: "poolId", type: "uint256", indexed: true }, { name: "seller", type: "address", indexed: true },
      { name: "price", type: "uint256", indexed: false }, { name: "minOrders", type: "uint32", indexed: false },
      { name: "deadline", type: "uint64", indexed: false }, { name: "title", type: "string", indexed: false },
    ],
  },
  {
    type: "event", name: "Pledged",
    inputs: [
      { name: "poolId", type: "uint256", indexed: true }, { name: "buyer", type: "address", indexed: true },
      { name: "nonce", type: "bytes32", indexed: false }, { name: "activeCount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "PledgeWithdrawn",
    inputs: [
      { name: "poolId", type: "uint256", indexed: true }, { name: "buyer", type: "address", indexed: true },
      { name: "activeCount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "PledgeDropped",
    inputs: [
      { name: "poolId", type: "uint256", indexed: true }, { name: "buyer", type: "address", indexed: true },
      { name: "activeCount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "Settled",
    inputs: [
      { name: "poolId", type: "uint256", indexed: true }, { name: "seller", type: "address", indexed: true },
      { name: "orders", type: "uint256", indexed: false }, { name: "total", type: "uint256", indexed: false },
    ],
  },
  { type: "error", name: "UnknownPool", inputs: [] },
  { type: "error", name: "PoolClosed", inputs: [] },
  { type: "error", name: "BadParams", inputs: [] },
  { type: "error", name: "AlreadyPledged", inputs: [] },
  { type: "error", name: "NotPledged", inputs: [] },
  { type: "error", name: "PoolFull", inputs: [] },
  { type: "error", name: "BadSignature", inputs: [] },
  { type: "error", name: "NonceUsed", inputs: [] },
  { type: "error", name: "NotAllowed", inputs: [] },
  { type: "error", name: "BelowThreshold", inputs: [] },
  { type: "error", name: "TransferFailed", inputs: [] },
  { type: "error", name: "Reentrancy", inputs: [] },
  { type: "error", name: "ShortDelivery", inputs: [] },
] as const;

export const tusd8Abi = [
  {
    type: "function", name: "cancelAuthorization", stateMutability: "nonpayable",
    inputs: [
      { name: "authorizer", type: "address" }, { name: "nonce", type: "bytes32" },
      { name: "v", type: "uint8" }, { name: "r", type: "bytes32" }, { name: "s", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function", name: "authorizationState", stateMutability: "view",
    inputs: [{ name: "authorizer", type: "address" }, { name: "nonce", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  {
    type: "event", name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true }, { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const;

/** EIP-712 domain of tUSD8 (name "tUSD8", version "2" per the starter kit; `npm run proof` checks it). */
export const tusd8Domain = {
  name: "tUSD8",
  version: "2",
  chainId: AEVUM_CHAIN_ID,
  verifyingContract: TUSD8_ADDRESS,
} as const;

/** Mirrors QuorumPool.nonceFor so the UI can show the nonce before signing. */
export function pledgeNonce(pool: Address, poolId: bigint, buyer: Address, round: bigint): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }, { type: "address" }, { type: "uint256" }],
      [pool, poolId, buyer, round],
    ),
  );
}

/** The exact typed data a buyer signs: recipient is the pool, amount and expiry fixed. */
export function receiveAuthTypedData(args: { buyer: Address; price: bigint; deadline: bigint; nonce: Hex }) {
  return {
    domain: tusd8Domain,
    types: {
      ReceiveWithAuthorization: [
        { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" },
      ],
    } as const,
    primaryType: "ReceiveWithAuthorization" as const,
    message: {
      from: args.buyer,
      to: POOL_ADDRESS ?? ("0x0000000000000000000000000000000000000000" as Address),
      value: args.price,
      validAfter: BigInt(0),
      validBefore: args.deadline,
      nonce: args.nonce,
    },
  };
}

export function cancelAuthTypedData(args: { buyer: Address; nonce: Hex }) {
  return {
    domain: tusd8Domain,
    types: { CancelAuthorization: [{ name: "authorizer", type: "address" }, { name: "nonce", type: "bytes32" }] } as const,
    primaryType: "CancelAuthorization" as const,
    message: { authorizer: args.buyer, nonce: args.nonce },
  };
}

export const explorerTx = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const explorerAddress = (a: string) => `${EXPLORER_URL}/address/${a}`;

/** Aevum caps eth_getLogs at 1,000 blocks, so history reads walk the range in chunks. */
export async function getLogsChunked<T>(
  fromBlock: bigint,
  toBlock: bigint,
  read: (from: bigint, to: bigint) => Promise<T[]>,
  chunk = BigInt(1000),
): Promise<T[]> {
  const out: T[] = [];
  for (let start = fromBlock; start <= toBlock; start += chunk) {
    const end = start + chunk - BigInt(1) > toBlock ? toBlock : start + chunk - BigInt(1);
    out.push(...(await read(start, end)));
  }
  return out;
}

// ------------------------------------------------------------------ live reads

const ZERO = "0x0000000000000000000000000000000000000000";

type History = {
  createTx?: Hex;
  settleTx?: Hex;
  createdBlock?: bigint;
  /** lowercase buyer address -> block of their latest Pledged log */
  pledgedAt: Map<string, bigint>;
  blockTimes: Map<bigint, string>;
};

/** Read this pool's events from the last LOG_LOOKBACK_BLOCKS blocks, 1,000 at a time. */
async function readHistory(poolId: bigint): Promise<History> {
  const history: History = { pledgedAt: new Map(), blockTimes: new Map() };
  const latest = await withTimeoutAndRetry(() => publicClient.getBlockNumber());
  const from = latest > LOG_LOOKBACK_BLOCKS ? latest - LOG_LOOKBACK_BLOCKS : BigInt(0);
  const raw = await getLogsChunked(from, latest, (f, t) =>
    withTimeoutAndRetry(() => publicClient.getLogs({ address: POOL_ADDRESS!, fromBlock: f, toBlock: t })),
  );
  const logs = parseEventLogs({ abi: quorumPoolAbi, logs: raw }).filter((l) => l.args.poolId === poolId);
  for (const l of logs) {
    if (l.eventName === "PoolCreated") {
      history.createTx = l.transactionHash ?? undefined;
      history.createdBlock = l.blockNumber ?? undefined;
    } else if (l.eventName === "Settled") {
      history.settleTx = l.transactionHash ?? undefined;
    } else if (l.eventName === "Pledged") {
      const buyer = (l.args as { buyer: Address }).buyer.toLowerCase();
      if (l.blockNumber !== null) history.pledgedAt.set(buyer, l.blockNumber);
    }
  }
  // Timestamps for the blocks we show, capped so one page view stays cheap.
  const blocks = [...new Set([history.createdBlock, ...history.pledgedAt.values()].filter((b): b is bigint => b !== undefined))].slice(0, 32);
  const stamps = await Promise.all(
    blocks.map((b) => withTimeoutAndRetry(() => publicClient.getBlock({ blockNumber: b })).catch(() => null)),
  );
  stamps.forEach((blk, i) => {
    if (blk) history.blockTimes.set(blocks[i], new Date(Number(blk.timestamp) * 1000).toISOString());
  });
  return history;
}

/**
 * One live pool. The pool, its count and its entrants come in one multicall; each
 * entrant's isPledged and tUSD8 balanceOf come in a second one. With `withHistory`
 * the per-buyer times and the create / settle tx hashes are filled from logs.
 */
async function readLivePool(poolId: bigint, withHistory: boolean): Promise<Campaign | null> {
  const pool = POOL_ADDRESS!;
  const [info, count, entrants] = await withTimeoutAndRetry(() =>
    publicClient.multicall({
      allowFailure: false,
      contracts: [
        { address: pool, abi: quorumPoolAbi, functionName: "pools", args: [poolId] },
        { address: pool, abi: quorumPoolAbi, functionName: "activeCount", args: [poolId] },
        { address: pool, abi: quorumPoolAbi, functionName: "entrantsOf", args: [poolId] },
      ],
    }),
  );
  const [seller, deadline, minOrders, maxOrders, settled, price, title] = info;
  if (seller === ZERO) return null;

  const calls: ContractFunctionParameters[] = entrants.flatMap((a) => [
    { address: pool, abi: quorumPoolAbi, functionName: "isPledged", args: [poolId, a] },
    { address: TUSD8_ADDRESS, abi: tusd8Abi, functionName: "balanceOf", args: [a] },
  ]);
  const perBuyer = calls.length
    ? ((await withTimeoutAndRetry(() => publicClient.multicall({ allowFailure: false, contracts: calls }))) as unknown as unknown[])
    : [];

  // History is optional: past HISTORY_BUDGET_MS the page renders without sign times.
  const history = withHistory ? await withBudget(readHistory(poolId), HISTORY_BUDGET_MS).catch(() => null) : null;

  const deadlineIso = new Date(Number(deadline) * 1000).toISOString();
  const closed = Number(deadline) * 1000 <= Date.now();
  const createdIso = (history?.createdBlock !== undefined && history.blockTimes.get(history.createdBlock)) || deadlineIso;

  const pledges: Pledge[] = entrants.map((a, i) => {
    const active = Boolean(perBuyer[i * 2]);
    const balance = typeof perBuyer[i * 2 + 1] === "bigint" ? (perBuyer[i * 2 + 1] as bigint) : BigInt(0);
    const state: PledgeState = !active ? "withdrawn" : settled ? "collected" : closed ? "expired" : "signed";
    const block = history?.pledgedAt.get(a.toLowerCase());
    return {
      buyer: shortHex(a),
      address: a,
      signedAt: (block !== undefined && history?.blockTimes.get(block)) || createdIso,
      state,
      balance: Number(formatUnits(balance, TUSD8_DECIMALS)),
    };
  });

  return {
    id: String(poolId),
    poolId: Number(poolId),
    maker: `Seller ${shortHex(seller)}`,
    makerPerson: seller,
    city: "Aevum testnet",
    product: title,
    blurb: `${count} of ${minOrders} orders signed on chain.`,
    pricePerOrder: Number(formatUnits(price, TUSD8_DECIMALS)),
    minOrders,
    maxOrders,
    createdAt: createdIso,
    deadline: deadlineIso,
    status: settled ? "settled" : closed ? "lapsed" : "open",
    seller,
    createTx: history?.createTx ?? "0x",
    settleTx: history?.settleTx,
    pledges,
  };
}

/**
 * Strict read of one campaign by its page id. Seed slugs ("kavruk-guji",
 * "kavruk-peru-lapsed", ...) always resolve from lib/data/seed.ts first, with no RPC.
 * Numeric ids resolve from QuorumPool. Returns null when the pool does not exist;
 * throws a CallError when Aevum does not answer, so lib/adapter/index.ts can fall back.
 */
export async function fetchCampaign(id: string): Promise<Campaign | null> {
  const seed = getSeedCampaign(id);
  if (seed) return seed;
  if (!POOL_ADDRESS || !/^\d{1,10}$/.test(id)) return null;
  return readLivePool(BigInt(id), true);
}

/** Strict list: the newest live pools (no log history, to keep the board cheap) then the seed batches. Throws when poolCount cannot be read. */
export async function fetchCampaignList(): Promise<Campaign[]> {
  if (!POOL_ADDRESS) return campaigns;
  const total = await withTimeoutAndRetry(() =>
    publicClient.readContract({ address: POOL_ADDRESS!, abi: quorumPoolAbi, functionName: "poolCount" }),
  );
  const ids: bigint[] = [];
  for (let i = total; i >= BigInt(1) && ids.length < LIVE_POOLS_ON_BOARD; i -= BigInt(1)) ids.push(i);
  const live = await Promise.all(ids.map((i) => readLivePool(i, false).catch(() => null)));
  return [...live.filter((c): c is Campaign => c !== null), ...campaigns];
}

/** Lenient form of fetchCampaign: null instead of an error. */
export async function loadCampaign(id: string): Promise<Campaign | null> {
  return fetchCampaign(id).catch(() => null);
}

/** Lenient form of fetchCampaignList: the seed batches instead of an error. */
export async function listCampaigns(): Promise<Campaign[]> {
  return fetchCampaignList().catch(() => campaigns);
}
