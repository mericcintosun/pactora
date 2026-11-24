// Real adapter: reads delegate to lib/aevum.ts (seed slugs plus live QuorumPool
// multicall reads). Writes are a stub until Phase 2 swaps them for the relayer path.
import { listCampaigns, loadCampaign } from "@/lib/aevum";
import type { CampaignAdapter } from "./types";

const notYet = (): never => {
  throw new Error("Real adapter is implemented in Phase 2");
};

export const realAdapter: CampaignAdapter = {
  mode: "real",

  async list() {
    return listCampaigns();
  },

  async get(id) {
    return loadCampaign(id);
  },

  async createBatch() {
    return notYet();
  },

  async pledge() {
    return notYet();
  },

  async withdraw() {
    return notYet();
  },

  async collect() {
    return notYet();
  },
};
