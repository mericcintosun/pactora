import type { Campaign } from "@/lib/types";

export type AdapterMode = "fake" | "real";

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
}

/**
 * The one seam between pages / API routes and the data source.
 * fake: seed data and deterministic placeholder hashes (lib/adapter/fake.ts).
 * real: QuorumPool on Aevum testnet (lib/adapter/real.ts, writes land in Phase 2).
 */
export interface CampaignAdapter {
  readonly mode: AdapterMode;
  list(): Promise<Campaign[]>;
  get(id: string): Promise<Campaign | null>;
  createBatch(draft: BatchDraftInput): Promise<TxResult>;
  pledge(id: string, buyer: string): Promise<TxResult>;
  withdraw(id: string, buyer: string): Promise<TxResult>;
  collect(id: string): Promise<TxResult>;
}
