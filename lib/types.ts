// Shared domain types for Pactora. Pure types only, so any module (including the
// Node seed script, which strips types) can import them with `import type`.
import type { ErrorCode } from "./errors";

export type CampaignStatus = "open" | "settled" | "lapsed";
export type PledgeState = "signed" | "withdrawn" | "collected" | "expired";

export interface Pledge {
  buyer: string;
  address: `0x${string}`;
  signedAt: string; // ISO
  state: PledgeState;
  /** tUSD8 balance of the buyer when the campaign closed (same before and after on a lapsed batch). */
  balance: number;
}

export interface Campaign {
  id: string;
  poolId: number;
  maker: string;
  makerPerson: string;
  city: string;
  product: string;
  blurb: string;
  pricePerOrder: number; // tUSD8
  minOrders: number;
  maxOrders: number;
  createdAt: string; // ISO
  deadline: string; // ISO, equals validBefore of every signature
  status: CampaignStatus;
  seller: `0x${string}`;
  createTx: `0x${string}`;
  settleTx?: `0x${string}`;
  pledges: Pledge[];
}

/** Shape of every JSON answer from the app's own API routes. */
export type ApiResponse<T> =
  | { ok: true; data: T; mode: "fake" | "real" }
  | { ok: false; error: ErrorCode; hint: string };

/** One tUSD8 Transfer decoded from a settle receipt. Values in whole tUSD8. */
export interface SettleTransfer {
  from: `0x${string}`;
  to: `0x${string}`;
  amount: number;
}

/** What POST /api/relay answers on success. */
export interface RelayOk {
  mode: "live" | "mock";
  txHash: `0x${string}`;
  /** settle only: every tUSD8 Transfer in the settle receipt */
  transfers?: SettleTransfer[];
  /** settle only: the total forwarded to the seller, in whole tUSD8 */
  sellerTotal?: number;
}
