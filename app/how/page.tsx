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

export default function HowPage() {
  const rows: [string, string, string | null][] = [
    ["Network", `Aevum testnet, chain id ${AEVUM_CHAIN_ID}, Shanghai EVM, legacy transactions`, null],
    ["tUSD8", TUSD8_ADDRESS, explorerAddress(TUSD8_ADDRESS)],
    ["QuorumPool", POOL_ADDRESS ?? "Not deployed yet. Set NEXT_PUBLIC_CONTRACT_ADDRESS after forge script Deploy.", POOL_ADDRESS ? explorerAddress(POOL_ADDRESS) : null],
    ["Multicall3", MULTICALL3, explorerAddress(MULTICALL3)],
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="pactora-enter grid gap-10 border-b-2 border-foreground pb-10 md:grid-cols-12">
        <div className="md:col-span-7">
          <h1 className="text-5xl font-bold leading-tight">The rules live in the signature</h1>
          <p className="mt-5 max-w-[68ch] text-lg leading-relaxed">
            Pactora is one Solidity contract, QuorumPool, and one token feature, EIP-3009 receiveWithAuthorization on tUSD8.
            A buyer signs a message that says: pay this pool exactly this much, before this time, with this nonce. The pool
            redeems every signature in one transaction once the minimum is met. Below the minimum it redeems none.
          </p>
        </div>
        <div className="border-2 border-foreground md:col-span-5">
          <SceneSlot
            n={3}
            alt="A single transaction drawn as a printing press sheet with five payment lines converging into one total for the maker"
            width={800}
            height={600}
          />
        </div>
      </div>

      <section className="pt-14">
        <h2 className="text-3xl font-bold">What a buyer signs</h2>
        <pre className="mt-5 overflow-x-auto border-2 border-foreground bg-card p-5 text-sm leading-relaxed">
{`ReceiveWithAuthorization {
  from:        <buyer>
  to:          <QuorumPool>         only the pool can redeem
  value:       price per order      fixed at signing
  validAfter:  0
  validBefore: batch deadline       expires on its own
  nonce:       keccak256(pool, poolId, buyer, round)
}
domain: { name: "tUSD8", version: "2", chainId: 44005 }`}
        </pre>
      </section>

      <section className="pt-14">
        <h2 className="text-3xl font-bold">Controls a buyer can rely on</h2>
        <div className="mt-6 grid gap-[2px] border-2 border-foreground bg-foreground sm:grid-cols-2 lg:grid-cols-3">
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
                <div key={k} className="grid gap-1 px-5 py-3 sm:grid-cols-[10rem_1fr]">
                  <dt className="text-xs font-semibold uppercase tracking-widest">{k}</dt>
                  <dd className="overflow-x-auto break-all text-sm">
                    {href ? (
                      <a href={href} target="_blank" rel="noreferrer" className="underline">
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
            body="This deploy has no contract address, so every batch runs in practice mode on seed data. The rules above are the same ones the contract enforces."
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
