// Shared domain types for Pactora. Pure types only, so any module (including the
// Node seed script, which strips types) can import them with `import type`.

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
  | { ok: false; error: string };
