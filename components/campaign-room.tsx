"use client";

import { useState } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { motion, useReducedMotion } from "motion/react";
import { createWalletClient, custom, parseUnits, type Address, type EIP1193Provider, type Hex } from "viem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBar, CardContent } from "@/components/ui/card";
import {
  aevumTestnet, cancelAuthTypedData, explorerAddress, explorerTx, POOL_ADDRESS, publicClient,
  quorumPoolAbi, receiveAuthTypedData, TUSD8_DECIMALS,
} from "@/lib/aevum";
import type { AdapterMode } from "@/lib/config";
import { DEMO_SIGNERS } from "@/lib/data/seed";
import type { ErrorCode } from "@/lib/errors";
import { formatTusd, formatUtc, shortHex } from "@/lib/format";
import { withTimeoutAndRetry } from "@/lib/http";
import { PRACTICE_NONCE, PRACTICE_SIGNATURE } from "@/lib/schemas";
import type { Campaign, Pledge, RelayOk, SettleTransfer } from "@/lib/types";
import { cn } from "@/lib/utils";

type LogEntry = { label: string; tx: string; mock: boolean };
type Phase = { kind: "idle" } | { kind: "busy"; what: string } | { kind: "error"; message: string };
type Receipt = { tx: string; mock: boolean; transfers?: SettleTransfer[]; sellerTotal?: number };

/** Codes from /api/relay plus two the browser raises itself. */
type RoomErrorCode = ErrorCode | "wallet_missing" | "wallet_refused";

class RoomError extends Error {
  readonly code: RoomErrorCode;
  constructor(code: RoomErrorCode, hint: string) {
    super(hint);
    this.code = code;
  }
}

/** Copy is chosen by error code; the server hint is used only where it names the exact contract rule. */
function messageFor(err: unknown, fallback: string): string {
  if (!(err instanceof RoomError)) {
    const text = err instanceof Error ? err.message : "";
    return /reject|denied|cancel/i.test(text) ? "The wallet request was declined. Nothing was signed." : fallback;
  }
  switch (err.code) {
    case "invalid_input":
    case "reverted":
      return err.message;
    case "rate_limited":
      return "Too many tries from this connection. Wait a minute and try again.";
    case "upstream_timeout":
      return "Aevum testnet is slow to answer. Nothing was charged; try again in a moment.";
    case "upstream_error":
    case "parse_failure":
      return "The relayer could not reach Aevum testnet. Nothing was charged.";
    case "not_configured":
      return "Live relaying is switched off on this deploy. The seeded batches still work in practice mode.";
    case "wallet_missing":
      return "Open a browser wallet on Aevum testnet to sign.";
    case "wallet_refused":
      return "The wallet request was declined. Nothing was signed.";
  }
}

async function relay(body: Record<string, unknown>): Promise<RelayOk> {
  const res = await fetch("/api/relay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => null)) as (Partial<RelayOk> & { error?: ErrorCode; hint?: string }) | null;
  if (!res.ok || !json || !json.txHash) {
    throw new RoomError(json?.error ?? "upstream_error", json?.hint ?? "The relayer did not answer.");
  }
  return { mode: json.mode ?? "mock", txHash: json.txHash, transfers: json.transfers, sellerTotal: json.sellerTotal };
}

function injected(): EIP1193Provider | undefined {
  return (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
}

async function liveWallet() {
  const eth = injected();
  if (!eth) throw new RoomError("wallet_missing", "No browser wallet.");
  const wallet = createWalletClient({ chain: aevumTestnet, transport: custom(eth) });
  const [account] = await wallet.requestAddresses();
  if (!account) throw new RoomError("wallet_refused", "No account.");
  await wallet.switchChain({ id: aevumTestnet.id }).catch(() => wallet.addChain({ chain: aevumTestnet }));
  return { wallet, account };
}

function readNonce(poolId: number, buyer: Address): Promise<Hex> {
  return withTimeoutAndRetry(() =>
    publicClient.readContract({ address: POOL_ADDRESS!, abi: quorumPoolAbi, functionName: "nonceFor", args: [BigInt(poolId), buyer] }),
  );
}

export function CampaignRoom({ campaign, mode }: { campaign: Campaign; mode: AdapterMode }) {
  const reduce = useReducedMotion();
  const [listRef] = useAutoAnimate<HTMLOListElement>();
  // Live only for a numeric pool id while the server says the real adapter is on.
  // Seed slugs always stay in practice mode, whatever the deploy.
  const live = mode === "real" && Boolean(POOL_ADDRESS) && /^\d+$/.test(campaign.id);
  const [status, setStatus] = useState(campaign.status);
  const [pledges, setPledges] = useState<Pledge[]>(campaign.pledges.filter((p) => p.state !== "withdrawn"));
  const [mine, setMine] = useState<Address | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [log, setLog] = useState<LogEntry[]>(
    campaign.createTx !== "0x" ? [{ label: "Batch opened", tx: campaign.createTx, mock: !live }] : [],
  );
  const [copied, setCopied] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(
    campaign.settleTx ? { tx: campaign.settleTx, mock: !live } : null,
  );

  const count = pledges.length;
  const ready = status === "open" && count >= campaign.minOrders;
  const iAmIn = mine !== null && pledges.some((p) => p.address.toLowerCase() === mine.toLowerCase());
  // Practice mode lets the next demo wallet sign while the last one can still withdraw,
  // so the counter can be walked all the way to the threshold.
  const practiceLeft = !live && DEMO_SIGNERS.some((s) => !pledges.some((p) => p.address === s.address));
  const canJoin = live ? !iAmIn : practiceLeft;

  async function join() {
    setPhase({ kind: "busy", what: "Waiting for your signature…" });
    try {
      let who: { buyer: string; address: Address };
      let r: RelayOk;
      if (live) {
        const { wallet, account } = await liveWallet();
        const nonce = await readNonce(campaign.poolId, account);
        const typed = receiveAuthTypedData({
          buyer: account,
          price: parseUnits(String(campaign.pricePerOrder), TUSD8_DECIMALS),
          deadline: BigInt(Math.floor(new Date(campaign.deadline).getTime() / 1000)),
          nonce,
        });
        const signature = await wallet.signTypedData({ account, ...typed });
        setPhase({ kind: "busy", what: "Relayer is posting your signature…" });
        r = await relay({ action: "pledge", poolId: campaign.poolId, buyer: account, signature });
        who = { buyer: "You", address: account };
      } else {
        const next = DEMO_SIGNERS.find((s) => !pledges.some((p) => p.address === s.address));
        if (!next) throw new RoomError("invalid_input", "All practice wallets have signed. Withdraw one to try again.");
        r = await relay({ action: "pledge", poolId: campaign.poolId, buyer: next.address, signature: PRACTICE_SIGNATURE, practice: true });
        who = next;
      }
      const mock = r.mode === "mock";
      setPledges((p) => [...p, { buyer: who.buyer, address: who.address, signedAt: new Date().toISOString(), state: "signed", balance: 0 }]);
      setMine(who.address);
      setLog((l) => [{ label: `${who.buyer} signed, no gas paid`, tx: r.txHash, mock }, ...l]);
      setPhase({ kind: "idle" });
    } catch (err) {
      setPhase({ kind: "error", message: messageFor(err, "Signing did not go through. Nothing was charged.") });
    }
  }

  async function withdraw() {
    if (!mine) return;
    setPhase({ kind: "busy", what: "Cancelling your authorization…" });
    try {
      let r: RelayOk;
      if (live) {
        const { wallet } = await liveWallet();
        const nonce = await readNonce(campaign.poolId, mine);
        const signature = await wallet.signTypedData({ account: mine, ...cancelAuthTypedData({ buyer: mine, nonce }) });
        setPhase({ kind: "busy", what: "Relayer is cancelling on tUSD8, then withdrawing from the pool…" });
        r = await relay({ action: "cancel", poolId: campaign.poolId, buyer: mine, nonce, signature });
      } else {
        r = await relay({
          action: "cancel", poolId: campaign.poolId, buyer: mine, nonce: PRACTICE_NONCE, signature: PRACTICE_SIGNATURE, practice: true,
        });
      }
      const name = pledges.find((p) => p.address === mine)?.buyer ?? "A buyer";
      setPledges((p) => p.filter((x) => x.address !== mine));
      setMine(null);
      setLog((l) => [{ label: `${name} withdrew, authorization cancelled`, tx: r.txHash, mock: r.mode === "mock" }, ...l]);
      setPhase({ kind: "idle" });
    } catch (err) {
      setPhase({ kind: "error", message: messageFor(err, "Withdrawal did not go through. Your signature is still live.") });
    }
  }

  async function collect() {
    setPhase({ kind: "busy", what: `Collecting ${count} payments in one transaction…` });
    try {
      const r = await relay({ action: "settle", poolId: campaign.poolId, ...(live ? {} : { practice: true }) });
      const mock = r.mode === "mock";
      const total = r.sellerTotal ?? count * campaign.pricePerOrder;
      setReceipt({ tx: r.txHash, mock, transfers: r.transfers, sellerTotal: r.sellerTotal });
      setStatus("settled");
      setPledges((p) => p.map((x) => ({ ...x, state: "collected" })));
      setLog((l) => [{ label: `${count} payments collected, ${formatTusd(total)} to ${campaign.maker}`, tx: r.txHash, mock }, ...l]);
      setPhase({ kind: "idle" });
    } catch (err) {
      setPhase({ kind: "error", message: messageFor(err, "Collection reverted. Nobody was charged.") });
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const pct = Math.min(100, (count / campaign.minOrders) * 100);
  const nameOf = (a: string) => pledges.find((p) => p.address.toLowerCase() === a.toLowerCase())?.buyer ?? shortHex(a);

  // Receipt rows: decoded tUSD8 transfers into the pool when the relayer sent them, else one row per signer.
  const pool = POOL_ADDRESS?.toLowerCase();
  const decodedIn = receipt?.transfers?.filter((t) => pool !== undefined && t.to.toLowerCase() === pool);
  const receiptRows = decodedIn && decodedIn.length > 0
    ? decodedIn.map((t) => ({ key: `${t.from}-${t.amount}`, buyer: nameOf(t.from), address: t.from, amount: t.amount }))
    : pledges.map((p) => ({ key: p.address, buyer: p.buyer, address: p.address, amount: campaign.pricePerOrder }));
  const sellerTotal = receipt?.sellerTotal ?? receiptRows.reduce((n, r) => n + r.amount, 0);

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
            {status === "open" && canJoin && (
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
              Practice mode: signatures come from demo wallets and hashes are placeholders, nothing is sent to Aevum.
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
              <li key={p.address} className="flex items-center justify-between gap-3 overflow-x-auto px-4 py-2.5 text-sm">
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

        {status === "settled" && receipt && (
          <Card>
            <CardBar>
              <span>Receipt, one transaction</span>
              <span>{receiptRows.length} transfers</span>
            </CardBar>
            <div className="overflow-x-auto border-b-2 border-foreground px-4 py-2.5 text-sm">
              Settle tx{" "}
              {receipt.mock ? (
                <span className="text-muted-foreground">practice {shortHex(receipt.tx)}</span>
              ) : (
                <a className="font-semibold underline" href={explorerTx(receipt.tx)} target="_blank" rel="noreferrer">
                  {shortHex(receipt.tx)}
                </a>
              )}
            </div>
            <ol className="divide-y-2 divide-foreground text-sm">
              {receiptRows.map((row, i) => (
                <li key={`receipt-${row.key}`} className="flex items-center justify-between gap-3 overflow-x-auto px-4 py-2">
                  <span className="min-w-0 whitespace-nowrap">
                    {i + 1}. {row.buyer} <span className="text-muted-foreground">{shortHex(row.address)}</span> to pool
                  </span>
                  <span className="whitespace-nowrap">{formatTusd(row.amount)}</span>
                </li>
              ))}
            </ol>
            <div className="flex items-center justify-between gap-3 overflow-x-auto border-t-2 border-foreground px-4 py-2.5 text-sm font-semibold">
              <span className="whitespace-nowrap">Total to {campaign.maker}</span>
              <span className="whitespace-nowrap">{formatTusd(sellerTotal)}</span>
            </div>
          </Card>
        )}

        <Card>
          <CardBar>On-chain trail</CardBar>
          <ul className="divide-y-2 divide-foreground text-sm">
            {log.length === 0 && <li className="px-4 py-4">Nothing on chain yet.</li>}
            {log.map((e) => (
              <li key={`${e.tx}-${e.label}`} className="overflow-x-auto px-4 py-2.5">
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
