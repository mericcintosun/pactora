// Fake adapter: reads the seed, answers writes with deterministic placeholder hashes.
// No clock, no randomness, no network. The default when ADAPTER_MODE is not "real".
import { activePledges, campaigns, getSeedCampaign, hexFrom } from "@/lib/data/seed";
import type { Campaign } from "@/lib/types";
import type { BatchDraftInput, CampaignAdapter, TxResult } from "./types";

const fakeTx = (seed: string): TxResult => ({ txHash: `0x${hexFrom(`fake:${seed}`, 64)}` as `0x${string}` });

function mustGet(id: string): Campaign {
  const c = getSeedCampaign(id);
  if (!c) throw new Error(`Unknown batch: ${id}`);
  return c;
}

export const fakeAdapter: CampaignAdapter = {
  mode: "fake",

  async list() {
    return campaigns;
  },

  async get(id) {
    return getSeedCampaign(id) ?? null;
  },

  async createBatch(draft: BatchDraftInput) {
    return fakeTx(`create:${draft.product}:${draft.price}:${draft.minOrders}:${draft.hours}`);
  },

  async pledge(id, buyer) {
    const c = mustGet(id);
    if (c.status !== "open") throw new Error("This batch is closed.");
    return fakeTx(`pledge:${id}:${buyer}`);
  },

  async withdraw(id, buyer) {
    const c = mustGet(id);
    if (c.status !== "open") throw new Error("This batch is closed.");
    return fakeTx(`withdraw:${id}:${buyer}`);
  },

  async collect(id) {
    const c = mustGet(id);
    if (c.status !== "open") throw new Error("This batch is closed.");
    if (activePledges(c).length < c.minOrders) throw new Error("Below the minimum. Nobody was charged.");
    return fakeTx(`settle:${id}`);
  },
};
