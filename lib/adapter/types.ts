import type { AdapterMode } from "@/lib/config";
import type { Campaign, SettleTransfer } from "@/lib/types";

export type { AdapterMode } from "@/lib/config";

/** What a seller fills in to open a batch. */
export interface BatchDraftInput {
  product: string;
  maker: string;
  /** tUSD8 per order */
  price: number;
  minOrders: number;
  maxOrders?: number;
  /** hours the batch stays open */
  hours: number;
}

/** Every write answers with the transaction that carried it. */
export interface TxResult {
  txHash: `0x${string}`;
  /** collect: the tUSD8 transfers decoded from the settle receipt (real mode) */
  transfers?: SettleTransfer[];
  /** collect: total to the seller in whole tUSD8 (real mode) */
  sellerTotal?: number;
  /** createBatch: the new pool id (real mode) */
  poolId?: number;
}

/**
 * The one seam between pages / API routes and the data source.
 * fake: seed data and deterministic placeholder hashes (lib/adapter/fake.ts).
 * real: QuorumPool on Aevum testnet through the server relayer (./real, imported only by ./index).
 * Signatures and nonces are optional so the fake adapter can ignore them.
 */
export interface CampaignAdapter {
  readonly mode: AdapterMode;
  list(): Promise<Campaign[]>;
  get(id: string): Promise<Campaign | null>;
  createBatch(draft: BatchDraftInput): Promise<TxResult>;
  pledge(id: string, buyer: string, signature?: string): Promise<TxResult>;
  withdraw(id: string, buyer: string, signature?: string, nonce?: string): Promise<TxResult>;
  collect(id: string): Promise<TxResult>;
}
