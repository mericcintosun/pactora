import type { Metadata } from "next";
import { BatchWorkspace, type BatchDraft } from "@/components/batch-workspace";
import { getAdapter } from "@/lib/adapter";

export const metadata: Metadata = {
  title: "Campaigns",
  description: "Open a pre-order batch or watch the ones gathering signatures on Aevum testnet.",
};

const BLANK: BatchDraft = { product: "", maker: "", price: "5", minOrders: "10", hours: "48" };

export default async function PledgeWorkspace({ searchParams }: { searchParams: Promise<{ example?: string }> }) {
  const { example } = await searchParams;
  const adapter = getAdapter();
  const [campaigns, seed] = await Promise.all([adapter.list(), example ? adapter.get(example) : Promise.resolve(null)]);
  const initial: BatchDraft = seed
    ? { product: seed.product, maker: seed.maker, price: String(seed.pricePerOrder), minOrders: String(seed.minOrders), hours: "24" }
    : BLANK;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="pactora-enter border-b-2 border-foreground pb-6">
        <h1 className="text-5xl font-bold">The batch desk</h1>
        <p className="mt-3 max-w-[68ch] text-lg leading-relaxed">
          {seed
            ? `${seed.makerPerson}'s numbers are loaded: ${seed.minOrders} orders at ${seed.pricePerOrder} tUSD8, open for 24 hours. Press Open batch to see what a seller sees.`
            : "Set a price, a minimum and a deadline. Buyers sign, and the batch collects only if the minimum is met."}
        </p>
      </div>
      <div className="mt-10">
        <BatchWorkspace campaigns={campaigns} initial={initial} />
      </div>
    </div>
  );
}
