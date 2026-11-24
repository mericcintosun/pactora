"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGroup, motion, MotionConfig } from "motion/react";
import { parseEventLogs, parseUnits, type Address, type Hex } from "viem";
import { CampaignBoard } from "@/components/campaign-board";
import { PoolAddress } from "@/components/pool-address";
import { Button } from "@/components/ui/button";
import { Card, CardBar, CardContent, CardFooter } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { WalletBar } from "@/components/wallet-bar";
import { POOL_ADDRESS, publicClient, quorumPoolAbi, TUSD8_DECIMALS } from "@/lib/aevum";
import { RECEIPT_TIMEOUT_MS, type AdapterMode } from "@/lib/config";
import { DEMO_SIGNERS, hexFrom } from "@/lib/data/seed";
import { formatTusd, shortHex } from "@/lib/format";
import { withTimeoutAndRetry } from "@/lib/http";
import type { Campaign } from "@/lib/types";
import {
  AEVUM_CHAIN_ID,
  accountOf,
  connectInjected,
  failureState,
  isBusy,
  TxError,
  walletClient,
  type WalletState,
} from "@/lib/wallet-state";

export interface BatchDraft {
  product: string;
  maker: string;
  price: string;
  minOrders: string;
  hours: string;
}

const PRACTICE_ACCOUNT = DEMO_SIGNERS[0].address as Address;

/** Practice path: a placeholder create hash, the batch joins the board below as a local draft. */
async function createPractice(draft: BatchDraft, click: number): Promise<Hex> {
  await new Promise((r) => setTimeout(r, 650));
  return `0x${hexFrom(`create:${draft.product}:${click}`, 64)}`;
}

/**
 * Live path: the seller's own wallet calls QuorumPool.createPool on Aevum (legacy gas
 * price), then the receipt gives the new pool id. The relayer-as-seller path lives in
 * lib/relayer.ts submitCreatePool and is used by the real adapter and npm run demo:reset.
 */
async function createLive(draft: BatchDraft, account: Address): Promise<{ tx: Hex; poolId?: number }> {
  if (!POOL_ADDRESS) throw new TxError("not_configured", "");
  const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(draft.hours) * 3600);
  const gasPrice = await withTimeoutAndRetry(() => publicClient.getGasPrice());
  const tx = await walletClient().writeContract({
    account,
    address: POOL_ADDRESS,
    abi: quorumPoolAbi,
    functionName: "createPool",
    args: [draft.product, parseUnits(draft.price, TUSD8_DECIMALS), Number(draft.minOrders), Number(draft.minOrders) * 2, deadline],
    gasPrice,
  });
  const receipt = await withTimeoutAndRetry(
    () => publicClient.waitForTransactionReceipt({ hash: tx, timeout: RECEIPT_TIMEOUT_MS }),
    { timeoutMs: RECEIPT_TIMEOUT_MS + 5_000 },
  );
  if (receipt.status !== "success") throw new TxError("reverted", "");
  const created = parseEventLogs({ abi: quorumPoolAbi, eventName: "PoolCreated", logs: receipt.logs })[0];
  return { tx, poolId: created ? Number(created.args.poolId) : undefined };
}

export function BatchWorkspace({ campaigns, initial, mode }: { campaigns: Campaign[]; initial: BatchDraft; mode: AdapterMode }) {
  const live = mode === "real" && Boolean(POOL_ADDRESS);
  const router = useRouter();
  const [draft, setDraft] = useState<BatchDraft>(initial);
  const [state, setStateRaw] = useState<WalletState>(
    live ? { kind: "disconnected" } : { kind: "idle", account: PRACTICE_ACCOUNT, practice: true },
  );
  const stateRef = useRef(state);
  const setState = (s: WalletState) => {
    stateRef.current = s;
    setStateRaw(s);
  };
  const lastRun = useRef<(() => void) | null>(null);
  const clicks = useRef(0);
  const [problem, setProblem] = useState<string | null>(null);
  const [opened, setOpened] = useState<{ poolId?: number } | null>(null);
  const [drafts, setDrafts] = useState<Campaign[]>([]);
  const busy = isBusy(state);
  // Once router.refresh() brings a live pool in from the chain, its local draft row is dropped.
  const board = [...drafts.filter((d) => !campaigns.some((c) => /^\d+$/.test(c.id) && c.poolId === d.poolId)), ...campaigns];
  const [preview, setPreview] = useState<{ id: string; signed: number } | null>(null);
  const previewCampaign = preview ? board.find((c) => c.id === preview.id) : undefined;
  const previewed = preview && previewCampaign ? { c: previewCampaign, signed: preview.signed } : null;

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

  async function connect(): Promise<Address | null> {
    setState({ kind: "connecting" });
    try {
      const { account, chainId } = await connectInjected();
      if (chainId !== AEVUM_CHAIN_ID) {
        setState({ kind: "wrong-network", account, chainId });
        return null;
      }
      setState({ kind: "idle", account, practice: false });
      return account;
    } catch (err) {
      setState(failureState(err, { action: "connect", account: null, practice: false }));
      return null;
    }
  }

  async function open(snapshot: BatchDraft, click: number) {
    lastRun.current = () => void open(snapshot, click);
    const current = stateRef.current;
    let who = current.kind === "wrong-network" ? null : accountOf(current);
    if (live && !who) {
      who = await connect();
      if (!who) return;
    }
    const practice = !live;
    setState({ kind: "tx-pending", account: who, practice, action: "create", label: live ? "Confirm createPool in your wallet, then wait for Aevum to mine it." : "Opening the practice batch." });
    try {
      const { tx, poolId } = live && who ? await createLive(snapshot, who) : { tx: await createPractice(snapshot, click), poolId: undefined };
      const now = Date.now();
      setDrafts((list) => [
        {
          id: `draft-${click}`, poolId: poolId ?? 100 + list.length, maker: snapshot.maker || "Your shop", makerPerson: "You", city: live ? "Aevum testnet" : "Draft",
          product: snapshot.product, blurb: "", pricePerOrder: Number(snapshot.price), minOrders: Number(snapshot.minOrders),
          maxOrders: Number(snapshot.minOrders) * 2, createdAt: new Date(now).toISOString(),
          deadline: new Date(now + Number(snapshot.hours) * 3_600_000).toISOString(), status: "open",
          seller: who ?? "0x0000000000000000000000000000000000000000", createTx: tx, pledges: [],
        },
        ...list,
      ]);
      setOpened({ poolId });
      setState({ kind: "tx-confirmed", account: who, practice, action: "create", txHash: tx, mock: !live });
      // A live pool now exists on chain: let the server component re-read the board.
      if (live) router.refresh();
    } catch (err) {
      setState(failureState(err, { action: "create", account: who, practice }));
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate();
    setProblem(found);
    if (found) return;
    void open({ ...draft }, ++clicks.current);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <Card className="h-fit lg:col-span-5">
        <CardBar>
          <span>Open a batch</span>
          <span>{live ? `Aevum ${AEVUM_CHAIN_ID}` : "Practice mode"}</span>
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
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
            {problem && (
              <p role="alert" className="border-2 border-bad px-3 py-2 text-sm text-bad">
                {problem}
              </p>
            )}
            <p className="border-l-2 border-foreground pl-3 text-sm leading-relaxed">
              {live
                ? `Open batch sends one createPool transaction from your wallet to QuorumPool${POOL_ADDRESS ? ` ${shortHex(POOL_ADDRESS)}` : ""}, recording ${Number(draft.price) || 0} tUSD8 per order, a minimum of ${draft.minOrders || "?"} orders and a deadline ${draft.hours || "?"} hours from now. You pay the gas in tQDAY and no tUSD8 moves.`
                : `Open batch records ${Number(draft.price) || 0} tUSD8 per order, a minimum of ${draft.minOrders || "?"} orders and a deadline ${draft.hours || "?"} hours from now. In practice mode nothing is sent to Aevum and no wallet opens.`}
            </p>
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
            {state.kind === "tx-confirmed" && (
              <p className="text-sm">
                {state.mock
                  ? "The practice batch sits at the top of the board below."
                  : opened?.poolId !== undefined
                    ? (
                        <Link className="font-semibold underline" href={`/pledge/${opened.poolId}`}>
                          Open pool #{opened.poolId}
                        </Link>
                      )
                    : "The pool is on chain; it appears on the board within 30 seconds."}
              </p>
            )}
          </CardContent>
          <CardFooter className="flex-wrap">
            <Button type="submit" size="lg" disabled={busy}>
              {state.kind === "tx-pending" ? "Waiting for wallet" : "Open batch"}
            </Button>
            <Button asChild variant="link" className="h-11">
              <Link href="/pledge/kavruk-guji">See a live one</Link>
            </Button>
            <PoolAddress className="w-full" />
          </CardFooter>
        </form>
      </Card>

      <div className="lg:col-span-7">
        {/* Kit K7 signature 2: "Preview room" on a row morphs its title block (layoutId campaign-<id>)
            into this room header. Board and preview share one client tree here, so the morph does
            not depend on a route change. MotionConfig honors prefers-reduced-motion. */}
        <MotionConfig reducedMotion="user">
          <LayoutGroup>
            {previewed && (
              <motion.section
                layoutId={`campaign-${previewed.c.id}`}
                layoutDependency={preview?.id ?? "none"}
                aria-label={`Room preview: ${previewed.c.product}`}
                className="mb-6 border-2 border-foreground bg-background"
              >
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 bg-foreground px-4 py-2 text-xs font-semibold uppercase tracking-widest text-background">
                  <span>Room preview</span>
                  <span>
                    {previewed.c.status === "open" ? "Gathering signatures" : previewed.c.status === "settled" ? "Collected" : "Lapsed, nobody charged"}
                  </span>
                </div>
                <div className="space-y-3 p-5">
                  <p className="text-xs font-semibold uppercase tracking-widest">
                    {previewed.c.maker}, {previewed.c.city}
                  </p>
                  <h2 className="text-2xl font-bold leading-tight sm:text-3xl">{previewed.c.product}</h2>
                  <p className="flex flex-wrap items-end gap-x-3">
                    <span className="font-display text-5xl font-bold leading-none">
                      {previewed.signed}/{previewed.c.minOrders}
                    </span>
                    <span className="pb-1 text-sm">signed at {formatTusd(previewed.c.pricePerOrder)} each</span>
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button asChild variant="secondary">
                      <Link href={`/pledge/${previewed.c.id}`}>Open the room</Link>
                    </Button>
                    <Button variant="outline" onClick={() => setPreview(null)}>
                      Back to the board
                    </Button>
                  </div>
                </div>
              </motion.section>
            )}
            <CampaignBoard
              campaigns={board}
              previewId={preview?.id ?? null}
              onPreview={(id, signed) => setPreview(id ? { id, signed } : null)}
            />
          </LayoutGroup>
        </MotionConfig>
      </div>
    </div>
  );
}
