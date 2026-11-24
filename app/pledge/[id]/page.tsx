import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CampaignRoom } from "@/components/campaign-room";
import { ModeLine } from "@/components/mode-line";
import { readCampaign, readCampaignList } from "@/lib/adapter";
import { explorerAddress } from "@/lib/aevum";
import { formatTusd, formatUtc, shortHex } from "@/lib/format";

export async function generateStaticParams() {
  const { data } = await readCampaignList();
  return data.map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { data: c } = await readCampaign(id);
  if (!c) return { title: "Batch not found" };
  return {
    title: `${c.product} by ${c.maker}`,
    description: `${c.minOrders} orders at ${formatTusd(c.pricePerOrder)}. Sign now, pay only if the batch fills.`,
  };
}

// Live pools change with every signature: re-render at most every 5 seconds.
export const revalidate = 5;

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Server read only (no client fetch): seed slugs first, live pools through the real adapter,
  // seed data through the FALLBACK in lib/adapter/index.ts when Aevum does not answer.
  const { data: campaign, mode, fallback } = await readCampaign(id);
  if (!campaign) {
    // A live pool id whose read fell back has no seed twin: show the retry boundary, not a 404.
    if (fallback) throw new Error("live pool read fell back with no seed twin");
    notFound();
  }

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
        <p className="mt-4 max-w-[68ch] overflow-x-auto text-sm leading-relaxed text-muted-foreground">
          Pool #{campaign.poolId}. Payments go to{" "}
          <a className="underline" href={explorerAddress(campaign.seller)} target="_blank" rel="noopener noreferrer" title={campaign.seller}>
            {shortHex(campaign.seller)}
          </a>
          . Every signature names this pool as the only recipient, {formatTusd(campaign.pricePerOrder)} as the only
          amount, and expires {formatUtc(campaign.deadline)}.
        </p>
      </header>
      <ModeLine mode={mode} fallback={fallback} className="mt-8" />
      <div className="mt-6">
        <CampaignRoom campaign={campaign} mode={mode} />
      </div>
    </div>
  );
}
