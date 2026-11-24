import type { Metadata } from "next";
import Link from "next/link";
import { CampaignBoard } from "@/components/campaign-board";
import { ModeLine } from "@/components/mode-line";
import { SceneSlot } from "@/components/scene-slot";
import { Button } from "@/components/ui/button";
import { Card, CardBar, CardContent } from "@/components/ui/card";
import { getAdapter } from "@/lib/adapter";
import { EXAMPLE_CAMPAIGN_ID } from "@/lib/data/seed";

export const metadata: Metadata = {
  title: { absolute: "Pactora: pre-orders that only charge when the batch is real" },
};

// In live mode the board includes the newest pools; refresh the static page every 30 seconds.
export const revalidate = 30;

export default async function Home() {
  const adapter = getAdapter();
  const campaigns = await adapter.list();
  const lapsed = campaigns.filter((c) => c.status === "lapsed");
  const lapsedBuyers = lapsed.reduce((n, c) => n + c.pledges.filter((p) => p.state === "expired").length, 0);

  return (
    <>
      {/* L7 diagonal: newsprint headline on one side, the live board on a clipped black block. */}
      <section className="relative isolate overflow-hidden border-b-2 border-foreground">
        <div aria-hidden className="pactora-diagonal absolute inset-0 -z-10 bg-foreground" />
        <div aria-hidden className="pactora-columns absolute inset-0 -z-20" />
        <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 pb-16 pt-12 lg:flex-row lg:items-start lg:pb-24 lg:pt-16">
          <div className="pactora-stagger lg:w-[44%]">
            <p className="text-sm font-semibold uppercase tracking-widest">Pre-orders for small makers</p>
            <h1 className="mt-4 text-5xl font-bold leading-[1.02] sm:text-6xl">
              Nobody pays until
              <span className="mt-2 block w-fit bg-foreground px-2 pb-1 text-background">the batch is real.</span>
            </h1>
            <p className="mt-6 max-w-[62ch] text-lg leading-relaxed">
              Buyers sign once and keep their money. When enough orders arrive, every payment is collected in a single
              transaction. If the count falls short by the deadline, nothing ever moved, so there is nothing to refund.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button asChild size="lg">
                <Link href={`/pledge?example=${EXAMPLE_CAMPAIGN_ID}`}>Open Ayşe&apos;s roast batch</Link>
              </Button>
              <Link href="/how" className="text-sm font-semibold underline decoration-2 underline-offset-4">
                Read the contract rules
              </Link>
            </div>
            <div className="mt-10 max-w-md border-2 border-foreground">
              <SceneSlot
                n={1}
                alt="A coffee roaster's chalkboard showing five order slots, three ticked, beside a cold drum roaster waiting for the batch"
                width={960}
                height={640}
              />
            </div>
          </div>

          <div className="pactora-enter lg:ml-auto lg:w-[52%] lg:pt-24">
            <CampaignBoard campaigns={campaigns} compact />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-20">
        <h2 className="border-b-2 border-foreground pb-3 text-4xl font-bold">The minimum order problem</h2>
        <div className="mt-8 grid gap-10 md:grid-cols-12">
          <div className="md:col-span-7">
            <p className="max-w-[68ch] text-lg leading-relaxed">
              A roaster needs five bags sold before a lot is worth the gas. A print shop needs twenty. Today they either take
              the money up front and promise refunds, or they collect promises in a group chat and watch half of them vanish
              when it is time to pay.
            </p>
            <details className="group mt-6 max-w-[68ch] border-2 border-foreground">
              <summary className="cursor-pointer list-none bg-foreground px-4 py-2 text-sm font-semibold uppercase tracking-widest text-background">
                Why on-chain crowdfunding did not fix it
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
            <CardBar>When a batch falls short</CardBar>
            <CardContent className="space-y-4">
              <SceneSlot
                n={2}
                alt="Three buyers' wallets drawn as ledgers, each showing the same balance before and after a lapsed pre-order"
                width={800}
                height={600}
              />
              <p className="leading-relaxed">
                {lapsed.length} batches on the board lapsed. Their {lapsedBuyers} buyers each ended with the exact balance they
                started with, because no transfer was ever made.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-20">
        <h2 className="border-b-2 border-foreground pb-3 text-4xl font-bold">One signature, three outcomes</h2>
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

      <div className="mx-auto max-w-6xl px-4 pb-4 pt-16">
        <ModeLine mode={adapter.mode} className="text-xs" />
      </div>
    </>
  );
}
