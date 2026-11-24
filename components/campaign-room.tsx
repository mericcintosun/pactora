"use client";

import { useState } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { motion, useReducedMotion } from "motion/react";
import { createWalletClient, custom, parseUnits, type Address, type EIP1193Provider, type Hex } from "viem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBar, CardContent } from "@/components/ui/card";
import {
  aevumTestnet, cancelAuthTypedData, explorerAddress, explorerTx, isLive, POOL_ADDRESS, publicClient,
  quorumPoolAbi, receiveAuthTypedData, TUSD8_DECIMALS,
} from "@/lib/aevum";
import { DEMO_SIGNERS, formatTusd, formatUtc, shortHex, type Campaign, type Pledge } from "@/lib/data";
import { cn } from "@/lib/utils";

type LogEntry = { label: string; tx: string; mock: boolean };
type Phase = { kind: "idle" } | { kind: "busy"; what: string } | { kind: "error"; message: string };

async function relay(body: Record<string, unknown>): Promise<{ txHash: string; mode: "live" | "mock" }> {
  const res = await fetch("/api/relay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json()) as { txHash?: string; mode?: "live" | "mock"; error?: string };
  if (!res.ok || !json.txHash) throw new Error(json.error ?? "The relayer did not answer. Try again in a moment.");
  return { txHash: json.txHash, mode: json.mode ?? "mock" };
}

function injected(): EIP1193Provider | undefined {
  return (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
}

export function CampaignRoom({ campaign }: { campaign: Campaign }) {
  const reduce = useReducedMotion();
  const [listRef] = useAutoAnimate<HTMLOListElement>();
  const [status, setStatus] = useState(campaign.status);
  const [pledges, setPledges] = useState<Pledge[]>(campaign.pledges.filter((p) => p.state !== "withdrawn"));
  const [mine, setMine] = useState<Address | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [log, setLog] = useState<LogEntry[]>(
    campaign.createTx !== "0x" ? [{ label: "Batch opened", tx: campaign.createTx, mock: !isLive }] : [],
  );
  const [copied, setCopied] = useState(false);

  const count = pledges.length;
  const ready = status === "open" && count >= campaign.minOrders;
  const live = isLive && /^\d+$/.test(campaign.id);
  const iAmIn = mine !== null && pledges.some((p) => p.address === mine);

  async function join() {
    setPhase({ kind: "busy", what: "Waiting for your signature…" });
    try {
      let who: { buyer: string; address: Address };
      let tx: string;
      let mock = true;
      if (live && injected()) {
        const wallet = createWalletClient({ chain: aevumTestnet, transport: custom(injected()!) });
        const [account] = await wallet.requestAddresses();
        const poolId = BigInt(campaign.poolId);
        const nonce = await publicClient.readContract({ address: POOL_ADDRESS!, abi: quorumPoolAbi, functionName: "nonceFor", args: [poolId, account] });
        const typed = receiveAuthTypedData({
          buyer: account,
          price: parseUnits(String(campaign.pricePerOrder), TUSD8_DECIMALS),
          deadline: BigInt(Math.floor(new Date(campaign.deadline).getTime() / 1000)),
          nonce,
        });
        const signature = await wallet.signTypedData({ account, ...typed });
        setPhase({ kind: "busy", what: "Relayer is posting your signature…" });
        const r = await relay({ action: "pledge", poolId: campaign.poolId, buyer: account, signature });
        who = { buyer: "You", address: account };
        tx = r.txHash;
        mock = r.mode === "mock";
      } else if (live) {
        throw new Error("Unlock a browser wallet on Aevum testnet to sign.");
      } else {
        // TODO: swap mock for the live path above once the pool is deployed.
        const next = DEMO_SIGNERS.find((s) => !pledges.some((p) => p.address === s.address));
        if (!next) throw new Error("All practice wallets have signed. Withdraw one to try again.");
        const r = await relay({ action: "pledge", poolId: campaign.poolId, buyer: next.address, signature: "0x00" });
        who = next;
        tx = r.txHash;
      }
      setPledges((p) => [...p, { buyer: who.buyer, address: who.address, signedAt: new Date().toISOString(), state: "signed", balance: 0 }]);
      setMine(who.address);
      setLog((l) => [{ label: `${who.buyer} signed, no gas paid`, tx, mock }, ...l]);
      setPhase({ kind: "idle" });
    } catch (err) {
      setPhase({ kind: "error", message: err instanceof Error ? err.message.split("\n")[0] : "Signing was cancelled." });
    }
  }

  async function withdraw() {
    if (!mine) return;
    setPhase({ kind: "busy", what: "Cancelling your authorization…" });
    try {
      let tx: string;
      let mock = true;
      if (live && injected()) {
        const wallet = createWalletClient({ chain: aevumTestnet, transport: custom(injected()!) });
        const nonce = (await publicClient.readContract({
          address: POOL_ADDRESS!, abi: quorumPoolAbi, functionName: "nonceFor", args: [BigInt(campaign.poolId), mine],
        })) as Hex;
        const signature = await wallet.signTypedData({ account: mine, ...cancelAuthTypedData({ buyer: mine, nonce }) });
        const r = await relay({ action: "cancel", poolId: campaign.poolId, buyer: mine, nonce, signature });
        tx = r.txHash;
        mock = r.mode === "mock";
      } else {
        tx = (await relay({ action: "cancel", poolId: campaign.poolId, buyer: mine, nonce: "0x00", signature: "0x00" })).txHash;
      }
      const name = pledges.find((p) => p.address === mine)?.buyer ?? "A buyer";
      setPledges((p) => p.filter((x) => x.address !== mine));
      setMine(null);
      setLog((l) => [{ label: `${name} withdrew, authorization cancelled`, tx, mock }, ...l]);
      setPhase({ kind: "idle" });
    } catch (err) {
      setPhase({ kind: "error", message: err instanceof Error ? err.message.split("\n")[0] : "Withdrawal failed." });
    }
  }

  async function collect() {
    setPhase({ kind: "busy", what: `Collecting ${count} payments in one transaction…` });
    try {
      const r = await relay({ action: "settle", poolId: campaign.poolId });
      setStatus("settled");
      setPledges((p) => p.map((x) => ({ ...x, state: "collected" })));
      setLog((l) => [{ label: `${count} payments collected, ${formatTusd(count * campaign.pricePerOrder)} to ${campaign.maker}`, tx: r.txHash, mock: r.mode === "mock" }, ...l]);
      setPhase({ kind: "idle" });
    } catch (err) {
      setPhase({ kind: "error", message: err instanceof Error ? err.message.split("\n")[0] : "Collection reverted. Nobody was charged." });
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const pct = Math.min(100, (count / campaign.minOrders) * 100);

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <Card className="lg:col-span-7">
        <CardBar>
          <span>{status === "open" ? "Gathering signatures" : status === "settled" ? "Collected" : "Lapsed, nobody charged"}</span>
          <span>Closes {formatUtc(campaign.deadline)}</span>
        </CardBar>
        <CardContent className="space-y-6">
          <div className="flex items-end gap-4">
            <motion.span
              key={count}
              initial={reduce ? false : { scale: 0.96, opacity: 0.4 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.38, ease: "easeOut" }}
              className="font-display text-7xl font-bold leading-none"
              aria-live="polite"
            >
              {count}/{campaign.minOrders}
            </motion.span>
            <p className="pb-2 text-sm leading-snug">
              signed at {formatTusd(campaign.pricePerOrder)} each
              <br />
              up to {campaign.maxOrders} orders
            </p>
          </div>
          <div className="h-4 border-2 border-foreground bg-muted" aria-hidden>
            <motion.div
              className={cn("h-full bg-foreground", status === "settled" && "bg-ok")}
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={{ duration: reduce ? 0 : 0.38, ease: "easeOut" }}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            {status === "open" && !iAmIn && (
              <Button size="lg" onClick={join} disabled={phase.kind === "busy" || count >= campaign.maxOrders}>
                Count me in
              </Button>
            )}
            {status === "open" && iAmIn && (
              <Button size="lg" variant="destructive" onClick={withdraw} disabled={phase.kind === "busy"}>
                Withdraw my signature
              </Button>
            )}
            {status === "open" && (
              <Button size="lg" variant="secondary" onClick={collect} disabled={!ready || phase.kind === "busy"}>
                Collect all payments
              </Button>
            )}
            <Button variant="outline" size="lg" onClick={copyLink}>
              {copied ? "Link copied" : "Copy link"}
            </Button>
          </div>

          <div role="status" className="min-h-6 text-sm">
            {phase.kind === "busy" && <p>{phase.what}</p>}
            {phase.kind === "error" && <p className="border-2 border-bad px-3 py-2 text-bad">{phase.message}</p>}
            {phase.kind === "idle" && status === "open" && (
              <p>
                {ready
                  ? "The minimum is met. Anyone can press collect; every payment moves in the same transaction."
                  : `${campaign.minOrders - count} more signatures needed. Your balance does not change when you sign.`}
              </p>
            )}
            {phase.kind === "idle" && status === "settled" && <p className="font-semibold text-ok">Every signed buyer paid once, in one transaction.</p>}
            {phase.kind === "idle" && status === "lapsed" && <p>The deadline passed below the minimum. Every signature expired unused.</p>}
          </div>
          {!live && (
            <p className="text-xs text-muted-foreground">
              Practice mode: signatures come from demo wallets and hashes are placeholders until the pool is deployed on Aevum.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-8 lg:col-span-5">
        <Card>
          <CardBar>
            <span>{status === "lapsed" ? "Balances, before and after" : "Who signed"}</span>
            <span>{count}</span>
          </CardBar>
          <ol ref={listRef} className="divide-y-2 divide-foreground">
            {pledges.length === 0 && <li className="px-4 py-6 text-sm">No signatures yet. Be the first.</li>}
            {pledges.map((p) => (
              <li key={p.address} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold">{p.buyer}</span>{" "}
                  <a href={explorerAddress(p.address)} target="_blank" rel="noreferrer" className="text-muted-foreground underline-offset-2 hover:underline">
                    {shortHex(p.address)}
                  </a>
                </span>
                {status === "lapsed" ? (
                  <span className="whitespace-nowrap">
                    {formatTusd(p.balance)} → {formatTusd(p.balance)}
                  </span>
                ) : p.state === "collected" ? (
                  <Badge variant="ok">Paid</Badge>
                ) : (
                  <Badge variant="outline">Signed</Badge>
                )}
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <CardBar>On-chain trail</CardBar>
          <ul className="divide-y-2 divide-foreground text-sm">
            {campaign.settleTx && status === "settled" && campaign.status === "settled" && (
              <li className="px-4 py-2.5">
                Collected in one transaction{" "}
                <a className="font-semibold underline" href={explorerTx(campaign.settleTx)} target="_blank" rel="noreferrer">
                  {shortHex(campaign.settleTx)}
                </a>
              </li>
            )}
            {log.length === 0 && <li className="px-4 py-4">Nothing on chain yet.</li>}
            {log.map((e) => (
              <li key={`${e.tx}-${e.label}`} className="px-4 py-2.5">
                {e.label}{" "}
                {e.mock ? (
                  <span className="text-muted-foreground">practice {shortHex(e.tx)}</span>
                ) : (
                  <a className="font-semibold underline" href={explorerTx(e.tx)} target="_blank" rel="noreferrer">
                    {shortHex(e.tx)}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
