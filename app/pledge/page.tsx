import type { Metadata } from "next";
import { BatchWorkspace, type BatchDraft } from "@/components/batch-workspace";
import { EmptyState } from "@/components/empty-state";
import { ModeLine } from "@/components/mode-line";
import { readCampaign, readCampaignList } from "@/lib/adapter";

export const metadata: Metadata = {
  title: "Campaigns",
  description: "Open a pre-order batch or watch the ones gathering signatures on Aevum testnet.",
};

const BLANK: BatchDraft = { product: "", maker: "", price: "5", minOrders: "10", hours: "48" };

export default async function PledgeWorkspace({ searchParams }: { searchParams: Promise<{ example?: string }> }) {
  const { example } = await searchParams;
  const [list, picked] = await Promise.all([readCampaignList(), example ? readCampaign(example) : Promise.resolve(null)]);
  const campaigns = list.data;
  const seed = picked?.data ?? null;
  const initial: BatchDraft = seed
    ? { product: seed.product, maker: seed.maker, price: String(seed.pricePerOrder), minOrders: String(seed.minOrders), hours: "24" }
    : BLANK;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="pactora-enter border-b-2 border-foreground pb-6">
        <h1 className="text-4xl font-bold sm:text-5xl">The batch desk</h1>
        <p className="mt-2 text-sm font-semibold uppercase tracking-widest">Open a batch, then sort the board below by need, deadline or price</p>
        <p className="mt-3 max-w-[68ch] text-lg leading-relaxed">
          {seed
            ? `${seed.makerPerson}'s numbers are loaded: ${seed.minOrders} orders at ${seed.pricePerOrder} tUSD8, open for 24 hours. Press Open batch to see what a seller sees.`
            : "Set a price, a minimum and a deadline. Buyers sign, and the batch collects only if the minimum is met."}
        </p>
      </div>
      {campaigns.length === 0 && (
        <EmptyState
          className="mt-10"
          title="The board is empty"
          body="No batches are gathering signatures right now. Open one with the form below, or start from the example roast."
          href="/pledge?example=kavruk-guji"
          cta="Load the example batch"
        />
      )}
      <div className="mt-10">
        <BatchWorkspace campaigns={campaigns} initial={initial} mode={list.mode} />
      </div>
      <ModeLine mode={list.mode} fallback={list.fallback} className="mt-10 text-xs" />
    </div>
  );
}
