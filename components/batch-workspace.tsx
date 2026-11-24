"use client";

import Link from "next/link";
import { useState } from "react";
import { createWalletClient, custom, parseUnits, type EIP1193Provider } from "viem";
import { CampaignBoard } from "@/components/campaign-board";
import { Button } from "@/components/ui/button";
import { Card, CardBar, CardContent, CardFooter } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { aevumTestnet, explorerTx, isLive, POOL_ADDRESS, quorumPoolAbi, TUSD8_DECIMALS } from "@/lib/aevum";
import { hexFrom } from "@/lib/data/seed";
import { shortHex } from "@/lib/format";
import type { Campaign } from "@/lib/types";

export interface BatchDraft {
  product: string;
  maker: string;
  price: string;
  minOrders: string;
  hours: string;
}

type Result = { kind: "idle" } | { kind: "busy" } | { kind: "error"; message: string } | { kind: "done"; tx: string; id: string; mock: boolean };

/**
 * Open a batch. Live: the seller's wallet calls QuorumPool.createPool on Aevum.
 * Mock: the batch joins the board below as a local draft with a placeholder hash.
 */
async function createBatch(draft: BatchDraft): Promise<{ tx: string; mock: boolean }> {
  const eth = typeof window !== "undefined" ? (window as unknown as { ethereum?: EIP1193Provider }).ethereum : undefined;
  if (!isLive || !eth || !POOL_ADDRESS) {
    // TODO: swap mock for the live createPool call once NEXT_PUBLIC_CONTRACT_ADDRESS is set.
    await new Promise((r) => setTimeout(r, 650));
    return { tx: `0x${hexFrom(`create:${draft.product}:${Date.now()}`, 64)}`, mock: true };
  }
  const wallet = createWalletClient({ chain: aevumTestnet, transport: custom(eth) });
  const [account] = await wallet.requestAddresses();
  await wallet.switchChain({ id: aevumTestnet.id }).catch(() => wallet.addChain({ chain: aevumTestnet }));
  const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(draft.hours) * 3600);
  const tx = await wallet.writeContract({
    account,
    address: POOL_ADDRESS,
    abi: quorumPoolAbi,
    functionName: "createPool",
    args: [draft.product, parseUnits(draft.price, TUSD8_DECIMALS), Number(draft.minOrders), Number(draft.minOrders) * 2, deadline],
  });
  return { tx, mock: false };
}

export function BatchWorkspace({ campaigns, initial }: { campaigns: Campaign[]; initial: BatchDraft }) {
  const [draft, setDraft] = useState<BatchDraft>(initial);
  const [result, setResult] = useState<Result>({ kind: "idle" });
  const [drafts, setDrafts] = useState<Campaign[]>([]);

  const set = (k: keyof BatchDraft) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  function validate(): string | null {
    if (draft.product.trim().length < 3) return "Name the product buyers are ordering.";
    if (!(Number(draft.price) > 0)) return "The price per order has to be above zero.";
    const min = Number(draft.minOrders);
    if (!Number.isInteger(min) || min < 1 || min > 64) return "Minimum orders must be a whole number from 1 to 64.";
    const h = Number(draft.hours);
    if (!(h >= 1 && h <= 24 * 30)) return "Give buyers between 1 hour and 30 days.";
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validate();
    if (problem) return setResult({ kind: "error", message: problem });
    setResult({ kind: "busy" });
    try {
      const { tx, mock } = await createBatch(draft);
      const id = `draft-${drafts.length + 1}`;
      const now = Date.now();
      setDrafts((list) => [
        {
          id, poolId: 100 + list.length, maker: draft.maker || "Your shop", makerPerson: "You", city: "Draft",
          product: draft.product, blurb: "", pricePerOrder: Number(draft.price), minOrders: Number(draft.minOrders),
          maxOrders: Number(draft.minOrders) * 2, createdAt: new Date(now).toISOString(),
          deadline: new Date(now + Number(draft.hours) * 3_600_000).toISOString(), status: "open",
          seller: "0x0000000000000000000000000000000000000000", createTx: tx as `0x${string}`, pledges: [],
        },
        ...list,
      ]);
      setResult({ kind: "done", tx, id, mock });
    } catch (err) {
      setResult({ kind: "error", message: err instanceof Error ? err.message.split("\n")[0] : "The wallet refused the request." });
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <Card className="h-fit lg:col-span-5">
        <CardBar>
          <span>Open a batch</span>
          <span>{isLive ? "Aevum 44005" : "Practice mode"}</span>
        </CardBar>
        <form onSubmit={submit}>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="product">What are buyers ordering</Label>
              <Input id="product" value={draft.product} onChange={set("product")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maker">Shop name</Label>
              <Input id="maker" value={draft.maker} onChange={set("maker")} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="price">tUSD8 each</Label>
                <Input id="price" inputMode="decimal" value={draft.price} onChange={set("price")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="min">Min orders</Label>
                <Input id="min" inputMode="numeric" value={draft.minOrders} onChange={set("minOrders")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hours">Hours open</Label>
                <Input id="hours" inputMode="numeric" value={draft.hours} onChange={set("hours")} />
              </div>
            </div>
            <p className="text-sm leading-relaxed">
              Collects <strong>{(Number(draft.price) || 0) * (Number(draft.minOrders) || 0)} tUSD8</strong> the moment{" "}
              {draft.minOrders || "?"} buyers have signed. Every signature expires at the deadline.
            </p>
            {result.kind === "error" && (
              <p role="alert" className="border-2 border-bad px-3 py-2 text-sm text-bad">
                {result.message}
              </p>
            )}
            {result.kind === "done" && (
              <div role="status" className="overflow-x-auto border-2 border-ok px-3 py-2 text-sm">
                <p className="font-semibold text-ok">Batch opened.</p>
                {result.mock ? (
                  <p>Practice hash {shortHex(result.tx)}. It sits at the top of the board below.</p>
                ) : (
                  <p>
                    Create transaction{" "}
                    <a className="underline" href={explorerTx(result.tx)} target="_blank" rel="noreferrer">
                      {shortHex(result.tx)}
                    </a>
                    .
                  </p>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" size="lg" disabled={result.kind === "busy"}>
              {result.kind === "busy" ? "Waiting for wallet…" : "Open batch"}
            </Button>
            <Button asChild variant="link">
              <Link href="/pledge/kavruk-guji">See a live one</Link>
            </Button>
          </CardFooter>
        </form>
      </Card>

      <div className="lg:col-span-7">
        <CampaignBoard campaigns={[...drafts, ...campaigns]} />
      </div>
    </div>
  );
}
