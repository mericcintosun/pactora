// The only file that reads ADAPTER_MODE. Server only: pages and API routes call
// getAdapter() and pass `mode` down to client components as a prop.
import { parseAdapterMode } from "@/lib/config";
import { fakeAdapter } from "./fake";
import { realAdapter } from "./real";
import type { CampaignAdapter } from "./types";

export type { AdapterMode, BatchDraftInput, CampaignAdapter, TxResult } from "./types";

/**
 * Real only when ADAPTER_MODE is exactly "real" AND NEXT_PUBLIC_CONTRACT_ADDRESS is set.
 * Anything else is the fake seed adapter, so a half-configured deploy never breaks the demo.
 */
export function getAdapter(): CampaignAdapter {
  return parseAdapterMode(process.env.ADAPTER_MODE) === "real" ? realAdapter : fakeAdapter;
}
