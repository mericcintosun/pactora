"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { motion, useReducedMotion } from "motion/react";
import { parseUnits, type Address, type Hex } from "viem";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBar, CardContent } from "@/components/ui/card";
import { WalletBar } from "@/components/wallet-bar";
import {
  cancelAuthTypedData, explorerAddress, explorerTx, POOL_ADDRESS, publicClient,
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
import {
  AEVUM_CHAIN_ID,
  accountOf,
  connectInjected,
  failureState,
  idempotencyKey,
  isBusy,
  TxError,
  walletClient,
  type TxAction,
  type WalletState,
} from "@/lib/wallet-state";

type LogEntry = { label: string; tx: string; mock: boolean };
type Receipt = { tx: string; mock: boolean; transfers?: SettleTransfer[]; sellerTotal?: number };
/** What one action hands back: the relay answer plus the local change to apply once it is confirmed. */
type Outcome = { ok: RelayOk; apply: () => void };
type Task = (who: Address | null, progress: (label: string) => void) => Promise<Outcome>;

/** The practice "connected account": the first seeded demo wallet. */
const PRACTICE_ACCOUNT = DEMO_SIGNERS[0].address as Address;

async function relay(body: Record<string, unknown>): Promise<RelayOk> {
  let res: Response;
  try {
    res = await fetch("/api/relay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new TxError("upstream_error", "");
  }
  const json = (await res.json().catch(() => null)) as (Partial<RelayOk> & { error?: ErrorCode; hint?: string }) | null;
  if (!res.ok || !json || !json.txHash) {
    throw new TxError(json?.error ?? "upstream_error", json?.hint ?? "");
  }
  return { mode: json.mode ?? "mock", txHash: json.txHash, transfers: json.transfers, sellerTotal: json.sellerTotal };
}

function readNonce(poolId: number, buyer: Address): Promise<Hex> {
  return withTimeoutAndRetry(() =>
    publicClient.readContract({ address: POOL_ADDRESS!, abi: quorumPoolAbi, functionName: "nonceFor", args: [BigInt(poolId), buyer] }),
  );
}

const activeOf = (c: Campaign) => c.pledges.filter((p) => p.state !== "withdrawn");
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function CampaignRoom({ campaign, mode }: { campaign: Campaign; mode: AdapterMode }) {
  const reduce = useReducedMotion();
  const router = useRouter();
  const [listRef] = useAutoAnimate<HTMLOListElement>();
  // Live only for a numeric pool id while the server says the real adapter is on.
  // Seed slugs always stay in practice mode, whatever the deploy.
  const live = mode === "real" && Boolean(POOL_ADDRESS) && /^\d+$/.test(campaign.id);

  const [state, setStateRaw] = useState<WalletState>(
    live ? { kind: "disconnected" } : { kind: "idle", account: PRACTICE_ACCOUNT, practice: true },
  );
  // Async handlers read the latest state through this ref, so a retry never acts on a stale render.
  const stateRef = useRef(state);
  const setState = (s: WalletState) => {
    stateRef.current = s;
    setStateRaw(s);
  };
  const lastRun = useRef<(() => void) | null>(null);
  const clicks = useRef(0);

  const [status, setStatus] = useState(campaign.status);
  const [pledges, setPledges] = useState<Pledge[]>(activeOf(campaign));
  // Practice only: the demo wallet that signed last, so it can withdraw.
  const [practiceMine, setPracticeMine] = useState<Address | null>(null);
  const [log, setLog] = useState<LogEntry[]>(
    campaign.createTx !== "0x" ? [{ label: "Batch opened", tx: campaign.createTx, mock: !live }] : [],
  );
  const [copied, setCopied] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(
    campaign.settleTx ? { tx: campaign.settleTx, mock: !live } : null,
  );

  // After router.refresh() the server component sends a fresh campaign read from the
  // chain. Adopt it during render (no effect, no client fetch).
  const [synced, setSynced] = useState(campaign);
  if (synced !== campaign) {
    setSynced(campaign);
    setPledges(activeOf(campaign));
    setStatus(campaign.status);
    if (campaign.settleTx) setReceipt((r) => r ?? { tx: campaign.settleTx!, mock: false });
  }

  const account = accountOf(state);
  const busy = isBusy(state);
  const count = pledges.length;
  const ready = status === "open" && count >= campaign.minOrders;
  // Live: a returning signer is recognised from the chain data in props as soon as the wallet connects.
  const mine: Address | null = live
    ? account && state.kind !== "wrong-network" && pledges.some((p) => same(p.address, account)) ? account : null
    : practiceMine;
  const iAmIn = mine !== null;
  // Practice mode lets the next demo wallet sign while the last one can still withdraw,
  // so the counter can be walked all the way to the threshold.
  const practiceLeft = !live && DEMO_SIGNERS.some((s) => !pledges.some((p) => p.address === s.address));
  const canJoin = live ? !iAmIn : practiceLeft;

  async function connect(): Promise<Address | null> {
    setState({ kind: "connecting" });
    try {
      const { account: who, chainId } = await connectInjected();
      if (chainId !== AEVUM_CHAIN_ID) {
        setState({ kind: "wrong-network", account: who, chainId });
        return null;
      }
      setState({ kind: "idle", account: who, practice: false });
      return who;
    } catch (err) {
      setState(failureState(err, { action: "connect", account: null, practice: false }));
      return null;
    }
  }

  /**
   * Every write runs through here: connect if a live wallet is needed, tx-pending while it
   * runs, tx-confirmed or tx-rejected / tx-failed after. The task is kept for retry, and
   * the task itself holds the idempotency key, so a retry re-sends the same key.
   */
  async function submit(action: TxAction, label: string, needsWallet: boolean, task: Task) {
    lastRun.current = () => void submit(action, label, needsWallet, task);
    const current = stateRef.current;
    let who: Address | null = current.kind === "wrong-network" ? null : accountOf(current);
    if (live && needsWallet && !who) {
      who = await connect();
      if (!who) return;
    }
    const practice = !live;
    setState({ kind: "tx-pending", account: who, practice, action, label });
    try {
      const out = await task(who, (next) => setState({ kind: "tx-pending", account: who, practice, action, label: next }));
      out.apply();
      setState({ kind: "tx-confirmed", account: who, practice, action, txHash: out.ok.txHash, mock: out.ok.mode === "mock" });
      // Live writes changed the chain: re-read the pool through the server component.
      // Practice never refreshes, because that would reset the in-memory practice state.
      if (out.ok.mode === "live") router.refresh();
    } catch (err) {
      setState(failureState(err, { action, account: who, practice }));
    }
  }

  function join() {
    const click = ++clicks.current;
    void submit("pledge", live ? "Waiting for your signature in the wallet." : "A practice wallet is signing.", true, async (who, progress) => {
      if (live && who) {
        const me: Address = who;
        const nonce = await readNonce(campaign.poolId, me);
        const typed = receiveAuthTypedData({
          buyer: me,
          price: parseUnits(String(campaign.pricePerOrder), TUSD8_DECIMALS),
          deadline: BigInt(Math.floor(new Date(campaign.deadline).getTime() / 1000)),
          nonce,
        });
        const signature = await walletClient().signTypedData({ account: me, ...typed });
        progress("The relayer is posting your signature to Aevum. No gas from you.");
        const ok = await relay({
          action: "pledge", poolId: campaign.poolId, buyer: me, signature,
          idempotencyKey: idempotencyKey("pledge", campaign.poolId, me, nonce),
        });
        return {
          ok,
          apply: () => {
            setPledges((p) => (p.some((x) => same(x.address, me)) ? p : [...p, { buyer: "You", address: me, signedAt: new Date().toISOString(), state: "signed", balance: 0 }]));
            setLog((l) => [{ label: "You signed, no gas paid", tx: ok.txHash, mock: false }, ...l]);
          },
        };
      }
      const next = DEMO_SIGNERS.find((s) => !pledges.some((p) => p.address === s.address));
      if (!next) throw new TxError("invalid_input", "All practice wallets have signed. Withdraw one to try again.");
      const ok = await relay({
        action: "pledge", poolId: campaign.poolId, buyer: next.address, signature: PRACTICE_SIGNATURE, practice: true,
        idempotencyKey: idempotencyKey("pledge", campaign.poolId, next.address, `click-${click}`),
      });
      return {
        ok,
        apply: () => {
          setPledges((p) => [...p, { buyer: next.buyer, address: next.address, signedAt: new Date().toISOString(), state: "signed", balance: 0 }]);
          setPracticeMine(next.address as Address);
          setLog((l) => [{ label: `${next.buyer} signed, no gas paid`, tx: ok.txHash, mock: ok.mode === "mock" }, ...l]);
        },
      };
    });
  }

  function withdraw() {
    const click = ++clicks.current;
    const target = mine;
    if (!target) return;
    const name = pledges.find((p) => same(p.address, target))?.buyer ?? "A buyer";
    void submit("cancel", live ? "Sign the cancellation in your wallet." : "Cancelling the practice authorization.", true, async (_who, progress) => {
      let ok: RelayOk;
      if (live) {
        const nonce = await readNonce(campaign.poolId, target);
        const signature = await walletClient().signTypedData({ account: target, ...cancelAuthTypedData({ buyer: target, nonce }) });
        progress("The relayer is cancelling on tUSD8, then withdrawing you from the pool.");
        ok = await relay({
          action: "cancel", poolId: campaign.poolId, buyer: target, nonce, signature,
          idempotencyKey: idempotencyKey("cancel", campaign.poolId, target, nonce),
        });
      } else {
        ok = await relay({
          action: "cancel", poolId: campaign.poolId, buyer: target, nonce: PRACTICE_NONCE, signature: PRACTICE_SIGNATURE, practice: true,
          idempotencyKey: idempotencyKey("cancel", campaign.poolId, target, `click-${click}`),
        });
      }
      return {
        ok,
        apply: () => {
          setPledges((p) => p.filter((x) => !same(x.address, target)));
          if (!live) setPracticeMine(null);
          setLog((l) => [{ label: `${name} withdrew, authorization cancelled`, tx: ok.txHash, mock: ok.mode === "mock" }, ...l]);
        },
      };
    });
  }

  function collect() {
    const click = ++clicks.current;
    const orders = count;
    // Anyone can collect and the relayer pays the gas, so no wallet is needed here.
    void submit("settle", `Collecting ${orders} payments in one transaction.`, false, async () => {
      const ok = await relay({
        action: "settle", poolId: campaign.poolId, ...(live ? {} : { practice: true }),
        idempotencyKey: idempotencyKey("settle", campaign.poolId, POOL_ADDRESS ?? "pool", live ? "settle" : `click-${click}`),
      });
      const total = ok.sellerTotal ?? orders * campaign.pricePerOrder;
      return {
        ok,
        apply: () => {
          setReceipt({ tx: ok.txHash, mock: ok.mode === "mock", transfers: ok.transfers, sellerTotal: ok.sellerTotal });
          setStatus("settled");
          setPledges((p) => p.map((x) => ({ ...x, state: "collected" })));
          setLog((l) => [{ label: `${orders} payments collected, ${formatTusd(total)} to ${campaign.maker}`, tx: ok.txHash, mock: ok.mode === "mock" }, ...l]);
        },
      };
    });
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const pct = Math.min(100, (count / campaign.minOrders) * 100);
  const nameOf = (a: string) => pledges.find((p) => same(p.address, a))?.buyer ?? shortHex(a);

  // Receipt rows: decoded tUSD8 transfers into the pool when the relayer sent them, else one row per signer.
  const pool = POOL_ADDRESS?.toLowerCase();
  const decodedIn = receipt?.transfers?.filter((t) => pool !== undefined && t.to.toLowerCase() === pool);
  const receiptRows = decodedIn && decodedIn.length > 0
    ? decodedIn.map((t) => ({ key: `${t.from}-${t.amount}`, buyer: nameOf(t.from), address: t.from, amount: t.amount }))
    : pledges.map((p) => ({ key: p.address, buyer: p.buyer, address: p.address, amount: campaign.pricePerOrder }));
  const sellerTotal = receipt?.sellerTotal ?? receiptRows.reduce((n, r) => n + r.amount, 0);
  const quiet = state.kind === "idle" || state.kind === "tx-confirmed";

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

          {status === "open" && (
            <WalletBar
              state={state}
              onConnect={
                live
                  ? () => {
                      lastRun.current = () => void connect();
                      void connect();
                    }
                  : undefined
              }
              onSwitched={() => void connect()}
              onRetry={() => lastRun.current?.()}
            />
          )}

          <div className="flex flex-wrap gap-3">
            {status === "open" && canJoin && (
              <Button id="sign" size="lg" onClick={join} disabled={busy || count >= campaign.maxOrders}>
                Count me in
              </Button>
            )}
            {status === "open" && iAmIn && (
              <Button size="lg" variant="destructive" onClick={withdraw} disabled={busy}>
                Withdraw my signature
              </Button>
            )}
            {status === "open" && (
              <Button size="lg" variant="secondary" onClick={collect} disabled={!ready || busy}>
                Collect all payments
              </Button>
            )}
            <Button variant="outline" size="lg" onClick={copyLink}>
              {copied ? "Link copied" : "Copy link"}
            </Button>
          </div>

          <div className="min-h-6 text-sm">
            {quiet && status === "open" && (
              <p>
                {ready
                  ? "The minimum is met. Anyone can press collect; every payment moves in the same transaction."
                  : `${campaign.minOrders - count} more signatures needed. Your balance does not change when you sign.`}
              </p>
            )}
            {status === "settled" && <p className="font-semibold text-ok">Every signed buyer paid once, in one transaction.</p>}
            {status === "lapsed" && <p>The deadline passed below the minimum. Every signature expired unused.</p>}
          </div>
          {!live && (
            <p className="text-xs text-muted-foreground">
              Practice mode: signatures come from demo wallets and hashes are placeholders, nothing is sent to Aevum. Reload the page to start over.
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
            {pledges.length === 0 && (
              <li className="p-4">
                {status === "open" ? (
                  <EmptyState
                    title="No signatures yet"
                    body={`This batch needs ${campaign.minOrders} signatures at ${formatTusd(campaign.pricePerOrder)}. Signing moves no money.`}
                    href="#sign"
                    cta="Count me in"
                  />
                ) : (
                  <p className="text-sm">Nobody signed this batch.</p>
                )}
              </li>
            )}
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
