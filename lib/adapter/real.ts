// Real adapter: reads delegate to lib/aevum.ts (seed slugs plus live QuorumPool
// multicall reads and logs); writes go through the server relayer in lib/relayer.ts.
// Only the selector in this folder (index.ts) imports this file; no client component imports either.
import { parseUnits } from "viem";
import { listCampaigns, loadCampaign } from "@/lib/aevum";
import { TUSD8_DECIMALS } from "@/lib/config";
import { isApiError, type ApiError } from "@/lib/errors";
import { submitCancel, submitCreatePool, submitPledge, submitSettle, type RelayResult } from "@/lib/relayer";
import type { BatchDraftInput, CampaignAdapter, TxResult } from "./types";

/** Adapter callers get an Error whose message is the plain hint and whose `code` is the ErrorCode. */
function unwrap(r: RelayResult | ApiError): TxResult {
  if (isApiError(r)) throw Object.assign(new Error(r.hint), { code: r.error });
  return r;
}

function livePoolId(id: string): number {
  if (!/^\d{1,10}$/.test(id)) {
    throw Object.assign(new Error("Seed batches are practice only; live writes need a numeric pool id."), { code: "invalid_input" });
  }
  return Number(id);
}

export const realAdapter: CampaignAdapter = {
  mode: "real",

  async list() {
    return listCampaigns();
  },

  async get(id) {
    return loadCampaign(id);
  },

  async createBatch(draft: BatchDraftInput) {
    const minOrders = Math.floor(draft.minOrders);
    return unwrap(
      await submitCreatePool({
        title: draft.product,
        price: parseUnits(String(draft.price), TUSD8_DECIMALS),
        minOrders,
        maxOrders: Math.floor(draft.maxOrders ?? minOrders * 2),
        deadline: BigInt(Math.floor(Date.now() / 1000) + Math.round(draft.hours * 3600)),
      }),
    );
  },

  async pledge(id, buyer, signature) {
    if (!signature) throw Object.assign(new Error("A live pledge needs the buyer's signature."), { code: "invalid_input" });
    return unwrap(await submitPledge({ poolId: livePoolId(id), buyer, signature }));
  },

  async withdraw(id, buyer, signature, nonce) {
    if (!signature || !nonce) {
      throw Object.assign(new Error("A live withdrawal needs the signed cancellation and its nonce."), { code: "invalid_input" });
    }
    return unwrap(await submitCancel({ poolId: livePoolId(id), buyer, nonce, signature }));
  },

  async collect(id) {
    return unwrap(await submitSettle({ poolId: livePoolId(id) }));
  },
};
