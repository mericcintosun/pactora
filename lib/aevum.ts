// Aevum testnet + tUSD8 integration. One module, two paths:
//   live: NEXT_PUBLIC_CONTRACT_ADDRESS is set, reads come from QuorumPool on chain 44005
//   mock: no address, the same functions return the seed campaigns from lib/data.ts
import {
  createPublicClient,
  defineChain,
  encodeAbiParameters,
  formatUnits,
  http,
  keccak256,
  type Address,
  type Hex,
} from "viem";
import { campaigns, getSeedCampaign, type Campaign } from "@/lib/data";

export const AEVUM_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 44005);
export const AEVUM_RPC = process.env.NEXT_PUBLIC_AEVUM_RPC ?? "https://rpc-test.qday.info";
export const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://explorer-test.qday.info";
export const TUSD8_ADDRESS = (process.env.NEXT_PUBLIC_TUSD8_ADDRESS ??
  "0x456569838f1d43009A91ebA4263147Afd7233483") as Address;
export const TUSD8_DECIMALS = Number(process.env.NEXT_PUBLIC_TUSD8_DECIMALS ?? 6);
export const POOL_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || undefined) as Address | undefined;
export const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11" as Address;

export const isLive = Boolean(POOL_ADDRESS);

export const aevumTestnet = defineChain({
  id: AEVUM_CHAIN_ID,
  name: "Aevum Testnet",
  nativeCurrency: { name: "tQDAY", symbol: "tQDAY", decimals: 18 },
  rpcUrls: { default: { http: [AEVUM_RPC] } },
  blockExplorers: { default: { name: "Aevum Explorer", url: EXPLORER_URL } },
  contracts: { multicall3: { address: MULTICALL3 } },
});

export const publicClient = createPublicClient({ chain: aevumTestnet, transport: http(AEVUM_RPC) });

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
  { type: "function", name: "settle", stateMutability: "nonpayable", inputs: [{ name: "poolId", type: "uint256" }], outputs: [] },
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
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

/** EIP-712 domain of tUSD8 (name "tUSD8", version "2" per the starter kit). */
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

/**
 * Load a campaign by its page id. Seed slugs always resolve from lib/data.ts.
 * Numeric ids resolve from QuorumPool when the contract address is configured.
 */
export async function loadCampaign(id: string): Promise<Campaign | null> {
  const seed = getSeedCampaign(id);
  if (seed) return seed;
  if (!isLive || !/^\d+$/.test(id)) return null;

  // Live path: read the pool and its entrants from Aevum in one multicall.
  const poolId = BigInt(id);
  try {
    const [pool, count, entrants] = await publicClient.multicall({
      allowFailure: false,
      contracts: [
        { address: POOL_ADDRESS!, abi: quorumPoolAbi, functionName: "pools", args: [poolId] },
        { address: POOL_ADDRESS!, abi: quorumPoolAbi, functionName: "activeCount", args: [poolId] },
        { address: POOL_ADDRESS!, abi: quorumPoolAbi, functionName: "entrantsOf", args: [poolId] },
      ],
    });
    const [seller, deadline, minOrders, maxOrders, settled, price, title] = pool;
    if (seller === "0x0000000000000000000000000000000000000000") return null;
    const deadlineIso = new Date(Number(deadline) * 1000).toISOString();
    const closed = Number(deadline) * 1000 < Date.now();
    return {
      id,
      poolId: Number(poolId),
      maker: `Seller ${seller.slice(0, 6)}`,
      makerPerson: seller,
      city: "Aevum testnet",
      product: title,
      blurb: `${count} of ${minOrders} orders signed on chain.`,
      pricePerOrder: Number(formatUnits(price, TUSD8_DECIMALS)),
      minOrders,
      maxOrders,
      createdAt: deadlineIso,
      deadline: deadlineIso,
      status: settled ? "settled" : closed ? "lapsed" : "open",
      seller,
      createTx: "0x",
      // TODO: fill per-buyer state from isPledged + Pledged logs via getLogsChunked
      pledges: entrants.map((a) => ({
        buyer: `${a.slice(0, 6)}…${a.slice(-4)}`,
        address: a,
        signedAt: deadlineIso,
        state: settled ? "collected" : "signed",
        balance: 0,
      })),
    };
  } catch {
    return null;
  }
}

export function listCampaigns(): Campaign[] {
  return campaigns;
}
