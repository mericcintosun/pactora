import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { SceneSlot } from "@/components/scene-slot";
import { Card, CardBar, CardContent } from "@/components/ui/card";
import { explorerAddress } from "@/lib/aevum";
import { AEVUM_CHAIN_ID, MULTICALL3, POOL_ADDRESS, TUSD8_ADDRESS } from "@/lib/config";

export const metadata: Metadata = {
  title: "How it works",
  description: "QuorumPool, tUSD8 receiveWithAuthorization and the Aevum testnet: the rules behind Pactora.",
};

const CONTROLS = [
  { title: "No custody", body: "Buyer funds stay in buyer wallets until the one settle transaction. There is no balance in the pool to drain." },
  { title: "Single recipient", body: "receiveWithAuthorization can only be called by its own recipient. That address is the pool, so a leaked signature is useless to anyone else." },
  { title: "Fixed amount", body: "The price is inside the signed message. The pool cannot take more, and a seller cannot change the price after you sign." },
  { title: "Automatic expiry", body: "validBefore equals the batch deadline. A short batch needs no cleanup: the signatures just stop working." },
  { title: "Instant withdrawal", body: "Sign a CancelAuthorization and the relayer submits it. The token marks the nonce used, the pool drops you, and you paid no gas." },
  { title: "All or nothing", body: "If any single redemption fails inside settle, the whole transaction reverts. Nobody is ever half charged." },
];

/** The ReceiveWithAuthorization fields a buyer signs: field, value, what it guarantees. */
const SIGNED_FIELDS: [string, string, string][] = [
  ["from", "the buyer", "the only wallet that can be charged"],
  ["to", "QuorumPool", "only the pool can redeem it"],
  ["value", "price per order", "fixed at signing"],
  ["validAfter", "0", "valid from the moment it is signed"],
  ["validBefore", "batch deadline", "expires on its own"],
  ["nonce", "keccak256(pool, poolId, buyer, round)", "bound to this pool and this buyer"],
];

export default function HowPage() {
  const rows: [string, string, string | null][] = [
    ["Network", `Aevum testnet, chain id ${AEVUM_CHAIN_ID}, Shanghai EVM, legacy transactions`, null],
    ["tUSD8", TUSD8_ADDRESS, explorerAddress(TUSD8_ADDRESS)],
    ["QuorumPool", POOL_ADDRESS ?? "Not deployed yet. Set NEXT_PUBLIC_CONTRACT_ADDRESS after forge script Deploy.", POOL_ADDRESS ? explorerAddress(POOL_ADDRESS) : null],
    ["Multicall3", MULTICALL3, explorerAddress(MULTICALL3)],
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="pactora-enter border-b-2 border-foreground pb-10">
        <h1 className="max-w-4xl text-4xl font-bold leading-tight sm:text-5xl">The rules live in the signature</h1>
        <p className="mt-5 max-w-[68ch] text-lg leading-relaxed">
          Pactora is one Solidity contract, QuorumPool, and one token feature, EIP-3009 receiveWithAuthorization on tUSD8.
          A buyer signs a message that says: pay this pool exactly this much, before this time, with this nonce. The pool
          redeems every signature in one transaction once the minimum is met. Below the minimum it redeems none.
        </p>
      </div>

      <section aria-labelledby="two-steps" className="pt-14">
        <h2 id="two-steps" className="text-3xl font-bold">Two steps, one transaction</h2>
        <div className="mt-6 grid border-2 border-foreground md:grid-cols-12">
          <article className="border-b-2 border-foreground md:col-span-5 md:border-b-0 md:border-r-2">
            <p className="bg-foreground px-4 py-2 text-xs font-semibold uppercase tracking-widest text-background">Step one: sign</p>
            <div className="space-y-4 p-5">
              <SceneSlot n={2}
                alt="A buyer's phone showing one typed-data signature for 2 tUSD8 addressed to the pool, with the wallet balance unchanged underneath"
                width={600}
                height={600}
              />
              <p className="max-w-[60ch] leading-relaxed">
                The buyer signs one message. No gas, no approval, and the balance stays where it is. The relayer posts the
                signature to QuorumPool.
              </p>
            </div>
          </article>
          <article className="md:col-span-7">
            <p className="bg-foreground px-4 py-2 text-xs font-semibold uppercase tracking-widest text-background">Step two: settle</p>
            <div className="space-y-4 p-5">
              <SceneSlot n={3}
                alt="Five signed payments of 2 tUSD8 drawn as press slugs, joined into one settle transaction that sends 10 tUSD8 to the maker"
                width={800}
                height={600}
              />
              <p className="max-w-[60ch] leading-relaxed">
                At the minimum, anyone presses collect. settle redeems every signature in the same transaction and forwards the
                total to the seller. One failed redemption reverts all of them.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section aria-labelledby="what-signed" className="pt-14">
        <h2 id="what-signed" className="text-3xl font-bold">What a buyer signs</h2>
        <p className="mt-3 max-w-[68ch] leading-relaxed">
          ReceiveWithAuthorization, EIP-712 domain name tUSD8, version 2, chain id {AEVUM_CHAIN_ID}.
        </p>
        <dl className="mt-5 divide-y-2 divide-foreground border-2 border-foreground text-sm">
          {SIGNED_FIELDS.map(([field, value, note]) => (
            <div key={field} className="grid grid-cols-1 gap-1 px-5 py-3 md:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)] md:gap-4">
              <dt className="text-xs font-semibold uppercase tracking-widest">{field}</dt>
              <dd className="break-words font-semibold">{value}</dd>
              <dd className="text-muted-foreground">{note}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="pt-14">
        <h2 className="text-3xl font-bold">Controls a buyer can rely on</h2>
        <div className="mt-6 grid gap-[2px] border-2 border-foreground bg-foreground md:grid-cols-2 lg:grid-cols-3">
          {CONTROLS.map((c) => (
            <article key={c.title} className="bg-background p-5">
              <h3 className="font-display text-xl font-bold">{c.title}</h3>
              <p className="mt-2 leading-relaxed">{c.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="pt-14">
        <Card>
          <CardBar>Addresses</CardBar>
          <CardContent className="p-0">
            <dl className="divide-y-2 divide-foreground">
              {rows.map(([k, v, href]) => (
                <div key={k} className="grid grid-cols-1 gap-1 px-5 py-3 md:grid-cols-[10rem_1fr]">
                  <dt className="text-xs font-semibold uppercase tracking-widest">{k}</dt>
                  <dd className="overflow-x-auto break-all text-sm">
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="underline" title={v}>
                        {v}
                      </a>
                    ) : (
                      v
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        {!POOL_ADDRESS && (
          <EmptyState
            className="mt-6"
            title="No QuorumPool on this deploy yet"
            body="QuorumPool is waiting on its redeploy, so every batch here runs in practice mode on sample batches. The rules above are the same ones the contract enforces, and its 14 Foundry tests pass."
            href="/pledge/kavruk-guji"
            cta="Back to the example batch"
          />
        )}
        <p className="mt-6 max-w-[68ch] leading-relaxed">
          Known constraint: a buyer who empties their wallet after signing would revert the whole settle. The seller can call
          dropPledge on that one buyer and collect from the rest. Ready to try it?{" "}
          <Link href="/pledge/kavruk-guji" className="font-semibold underline decoration-2 underline-offset-4">
            Sign into Ayşe&apos;s batch
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
