import { fakeAdapter } from "./fake";
import { realAdapter } from "./real";
import type { CampaignAdapter } from "./types";

export type { AdapterMode, BatchDraftInput, CampaignAdapter, TxResult } from "./types";

/** Real only when ADAPTER_MODE is exactly "real"; anything else is the fake seed adapter. */
export function getAdapter(): CampaignAdapter {
  return process.env.ADAPTER_MODE === "real" ? realAdapter : fakeAdapter;
}
