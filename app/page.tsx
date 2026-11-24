import type { Metadata } from "next";
import Link from "next/link";
import { CampaignBoard } from "@/components/campaign-board";
import { ModeLine } from "@/components/mode-line";
import { SceneSlot } from "@/components/scene-slot";
import { Button } from "@/components/ui/button";
import { Card, CardBar, CardContent } from "@/components/ui/card";
import { readCampaignList } from "@/lib/adapter";
import { EXAMPLE_CAMPAIGN_ID, getSeedCampaign, LAPSED_EXAMPLE_ID } from "@/lib/data/seed";
import { formatTusd } from "@/lib/format";

export const metadata: Metadata = {
  title: { absolute: "Pactora: pre-orders that only charge when the batch is real" },
};

// In live mode the board includes the newest pools; refresh the static page every 30 seconds.
export const revalidate = 30;

export default async function Home() {
  // Server read only; seed data through the FALLBACK in lib/adapter/index.ts when Aevum does not answer.
  const { data: campaigns, mode, fallback } = await readCampaignList();
  const lapsed = campaigns.filter((c) => c.status === "lapsed");
  const lapsedBuyers = lapsed.reduce((n, c) => n + c.pledges.filter((p) => p.state === "expired").length, 0);
  // The demo's closing batch: Kavruk's Peru lot, lapsed at 3 of 5. Always a seed record.
  const lapsedExample = campaigns.find((c) => c.id === LAPSED_EXAMPLE_ID) ?? getSeedCampaign(LAPSED_EXAMPLE_ID);
  const lapsedSigners = lapsedExample ? lapsedExample.pledges.filter((p) => p.state !== "withdrawn") : [];

  return (
    <>
      {/* L7 diagonal. lg: newsprint headline left, the live board on a clip-path black block right.
          Below lg the halves stack: headline, then the board in its own slanted black block, then the scene. */}
      <section className="relative isolate overflow-hidden border-b-2 border-foreground">
        <div aria-hidden className="pactora-diagonal absolute inset-0 -z-10 hidden bg-foreground lg:block" />
        <div aria-hidden className="pactora-columns absolute inset-0 -z-20" />
        <div className="mx-auto flex max-w-6xl flex-col px-4 pt-12 lg:flex-row lg:items-start lg:gap-12 lg:pb-20 lg:pt-14">
          <div className="contents lg:block lg:w-[44%]">
            <div className="pactora-stagger order-1">
              <p className="text-sm font-semibold uppercase tracking-widest">Pre-orders for small makers</p>
              <h1 className="mt-4 text-5xl font-bold leading-[1.02] sm:text-6xl">
                Nobody pays until
                <span className="mt-2 block w-fit bg-foreground px-2 pb-1 text-background">the batch is real.</span>
              </h1>
              <p className="mt-6 max-w-[62ch] text-lg leading-relaxed">
                Buyers only sign. When enough orders arrive, every payment is collected in one transaction; if the batch falls
                short, nobody&apos;s money ever moves.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Button asChild size="lg">
                  <Link href={`/pledge?example=${EXAMPLE_CAMPAIGN_ID}`}>Open Ayşe&apos;s roast batch</Link>
                </Button>
                <Link href="/how" className="inline-flex min-h-11 items-center text-sm font-semibold underline decoration-2 underline-offset-4">
                  Read the contract rules
                </Link>
              </div>
            </div>
            <div className="order-3 mb-12 mt-10 max-w-md border-2 border-foreground lg:mb-0 lg:max-w-sm">
              <SceneSlot n={1}
                alt="A roaster's batch card for five bags of Guji natural, three ticked and two open, beside a cold drum roaster waiting for the batch to fill"
                width={960}
                height={640}
              />
            </div>
          </div>

          <div className="pactora-slant order-2 -mx-4 mt-12 bg-foreground px-4 pb-10 pt-16 lg:order-none lg:mx-0 lg:ml-auto lg:mt-0 lg:w-[52%] lg:bg-transparent lg:p-0">
            <div className="pactora-enter">
              <CampaignBoard campaigns={campaigns} compact pinned={[EXAMPLE_CAMPAIGN_ID, LAPSED_EXAMPLE_ID]} />
            </div>
            <ModeLine mode={mode} fallback={fallback} className="mt-4 text-xs" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-20">
        <h2 className="border-b-2 border-foreground pb-3 text-3xl font-bold sm:text-4xl">The minimum order problem</h2>
        <div className="mt-8 grid gap-10 md:grid-cols-12">
          <div className="md:col-span-7">
            <p className="max-w-[68ch] text-lg leading-relaxed">
              A roaster needs five bags sold before a lot is worth the gas. A print shop needs twenty. Today they either take
              the money up front and promise refunds, or they collect promises in a group chat and watch half of them vanish
              when it is time to pay.
            </p>
            <details className="group mt-6 max-w-[68ch] border-2 border-foreground">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-foreground px-4 py-2 text-sm font-semibold uppercase tracking-widest text-background [&::-webkit-details-marker]:hidden">
                <span>Why on-chain crowdfunding did not fix it</span>
                <span className="shrink-0 underline underline-offset-4 group-open:hidden">Open</span>
                <span className="hidden shrink-0 underline underline-offset-4 group-open:inline">Close</span>
              </summary>
              <div className="space-y-3 p-4 leading-relaxed">
                <p>
                  Most crowdfunding contracts lock the money inside the contract. When a campaign fails, every backer has to
                  call refund on their own and pay gas to get their own money back.
                </p>
                <p>
                  Pactora never takes custody. Each buyer signs a tUSD8 authorization whose only possible recipient is the pool
                  contract, for a fixed amount, expiring at the deadline. The contract can redeem all of them at once, or none.
                </p>
              </div>
            </details>
          </div>
          <Card className="md:col-span-5">
            <CardBar>
              <span>When a batch falls short</span>
              {lapsedExample && (
                <span>
                  {lapsedSigners.length} of {lapsedExample.minOrders} signed
                </span>
              )}
            </CardBar>
            <CardContent className="space-y-4">
              {lapsedExample && (
                <>
                  <p className="font-display text-lg font-bold leading-snug">{lapsedExample.product}</p>
                  <ul className="divide-y-2 divide-foreground border-2 border-foreground text-sm">
                    {lapsedSigners.map((p) => (
                      <li key={p.address} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2">
                        <span className="min-w-0 truncate font-semibold">{p.buyer}</span>
                        <span className="whitespace-nowrap">
                          {formatTusd(p.balance)} to {formatTusd(p.balance)}, <strong>unchanged</strong>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/pledge/${LAPSED_EXAMPLE_ID}`}
                    className="inline-flex min-h-11 items-center text-sm font-semibold underline decoration-2 underline-offset-4"
                  >
                    Open the lapsed batch
                  </Link>
                </>
              )}
              <p className="leading-relaxed">
                {lapsed.length} batches on the board lapsed. All {lapsedBuyers} of their buyers kept the exact balance they
                started with, because no transfer was ever made.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-20">
        <h2 className="border-b-2 border-foreground pb-3 text-3xl font-bold sm:text-4xl">One signature, three outcomes</h2>
        <div className="mt-8 grid border-2 border-foreground md:grid-cols-3">
          <article className="border-b-2 border-foreground p-5 md:border-b-0 md:border-r-2">
            <h3 className="font-display text-xl font-bold">You sign</h3>
            <p className="mt-2 leading-relaxed">
              Your wallet asks for one typed-data signature. No gas, no approval, no balance change. The relayer posts it to
              the pool.
            </p>
          </article>
          <article className="border-b-2 border-foreground p-5 md:border-b-0 md:border-r-2">
            <h3 className="font-display text-xl font-bold">The count fills</h3>
            <p className="mt-2 leading-relaxed">
              The moment signatures reach the minimum, anyone can press collect. Every payment moves in the same transaction
              and the maker gets the total.
            </p>
          </article>
          <article className="p-5">
            <h3 className="font-display text-xl font-bold">Or the clock runs out</h3>
            <p className="mt-2 leading-relaxed">
              Signatures expire at the deadline on their own. Changed your mind earlier? Withdraw with one more signature, still
              gasless.
            </p>
          </article>
        </div>
      </section>
    </>
  );
}
