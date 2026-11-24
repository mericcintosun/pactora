import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CampaignRoom } from "@/components/campaign-room";
import { explorerAddress, loadCampaign } from "@/lib/aevum";
import { campaigns, formatTusd, formatUtc, shortHex } from "@/lib/data";

export function generateStaticParams() {
  return campaigns.map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const c = await loadCampaign(id);
  if (!c) return { title: "Batch not found" };
  return {
    title: `${c.product} by ${c.maker}`,
    description: `${c.minOrders} orders at ${formatTusd(c.pricePerOrder)}. Sign now, pay only if the batch fills.`,
  };
}

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await loadCampaign(id);
  if (!campaign) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Link href="/pledge" className="text-sm font-semibold underline decoration-2 underline-offset-4">
        All campaigns
      </Link>
      <header className="pactora-enter mt-6 border-b-2 border-foreground pb-6">
        <p className="text-sm font-semibold uppercase tracking-widest">
          {campaign.maker}, {campaign.city}
        </p>
        <h1 className="mt-3 max-w-4xl text-4xl font-bold leading-tight sm:text-5xl">{campaign.product}</h1>
        {campaign.blurb && <p className="mt-4 max-w-[68ch] text-lg leading-relaxed">{campaign.blurb}</p>}
        <p className="mt-4 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">
          Pool #{campaign.poolId}. Payments go to{" "}
          <a className="underline" href={explorerAddress(campaign.seller)} target="_blank" rel="noreferrer">
            {shortHex(campaign.seller)}
          </a>
          . Every signature names this pool as the only recipient, {formatTusd(campaign.pricePerOrder)} as the only
          amount, and expires {formatUtc(campaign.deadline)}.
        </p>
      </header>
      <div className="mt-10">
        <CampaignRoom campaign={campaign} />
      </div>
    </div>
  );
}
