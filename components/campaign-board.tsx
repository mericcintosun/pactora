"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { motion, MotionConfig } from "motion/react";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { activePledges } from "@/lib/data/seed";
import { formatTusd, formatUtc } from "@/lib/format";
import type { Campaign, CampaignStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filter = "all" | CampaignStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Gathering" },
  { key: "settled", label: "Collected" },
  { key: "lapsed", label: "Lapsed" },
];

const STATUS_RANK: Record<CampaignStatus, number> = { open: 0, settled: 1, lapsed: 2 };

type Row = { c: Campaign; signed: number; needed: number };

/**
 * Kit K7 signature 3: the inline sort. "board" is the server-rendered order (pinned demo
 * batches first, then status, then fewest signatures still needed), so the HTML reads the
 * same with JavaScript off. The other keys sort on real Campaign fields only: minOrders
 * minus active pledges, deadline, pricePerOrder. Ties fall back to the pool number.
 */
type SortKey = "board" | "needed" | "deadline" | "price";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "board", label: "Board order" },
  { key: "needed", label: "Needs most signatures" },
  { key: "deadline", label: "Closes soonest" },
  { key: "price", label: "Price" },
];

const ms = (iso: string) => new Date(iso).getTime();

const COMPARE: Record<SortKey, (a: Row, b: Row) => number> = {
  board: (a, b) => STATUS_RANK[a.c.status] - STATUS_RANK[b.c.status] || a.needed - b.needed || a.c.poolId - b.c.poolId,
  needed: (a, b) => b.needed - a.needed || a.c.poolId - b.c.poolId,
  // Batches still gathering come first, the one closing soonest on top; closed ones follow, newest close first.
  deadline: (a, b) => {
    const aOpen = a.c.status === "open" ? 0 : 1;
    const bOpen = b.c.status === "open" ? 0 : 1;
    if (aOpen !== bOpen) return aOpen - bOpen;
    const d = aOpen === 0 ? ms(a.c.deadline) - ms(b.c.deadline) : ms(b.c.deadline) - ms(a.c.deadline);
    return d || a.c.poolId - b.c.poolId;
  },
  price: (a, b) => a.c.pricePerOrder - b.c.pricePerOrder || a.c.poolId - b.c.poolId,
};

const SORT_NOTE: Record<SortKey, string> = {
  board: "Board order: the example batch and the lapsed one first, then by how many orders each batch still needs.",
  needed: "Sorted by signatures still needed, most first.",
  deadline: "Sorted by deadline: gathering batches closing soonest first, then closed ones.",
  price: "Sorted by price per order, cheapest first.",
};

/**
 * Kit K7 signature 1: an auto-animated collection (useAutoAnimate on the list). Filtering,
 * sorting and "+ Sign" change real seed counts and the rows move.
 * Kit K7 signature 2: each row's title block carries layoutId `campaign-<id>`. On /pledge
 * the batch desk renders a room preview with the same layoutId inside one LayoutGroup, so
 * "Preview room" morphs the row into the room header. layoutDependency keeps Motion from
 * re-measuring on sorts, which AutoAnimate already animates.
 */
export function CampaignBoard({
  campaigns,
  compact = false,
  pinned = [],
  previewId = null,
  onPreview,
  className,
}: {
  campaigns: Campaign[];
  compact?: boolean;
  /** Ids shown first in board order (the home page pins the demo pair). */
  pinned?: string[];
  previewId?: string | null;
  onPreview?: (id: string | null, signed: number) => void;
  className?: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("board");
  const [extra, setExtra] = useState<Record<string, number>>({});
  const [listRef] = useAutoAnimate<HTMLUListElement>({ duration: 260, easing: "ease-out" });

  const rows = useMemo(() => {
    const pin = (r: Row) => {
      const i = pinned.indexOf(r.c.id);
      return i === -1 ? pinned.length : i;
    };
    return campaigns
      .map((c): Row => {
        const signed = activePledges(c).length + (extra[c.id] ?? 0);
        return { c, signed, needed: Math.max(c.minOrders - signed, 0) };
      })
      .filter((r) => filter === "all" || r.c.status === filter)
      .sort((a, b) => (sort === "board" ? pin(a) - pin(b) : 0) || COMPARE[sort](a, b))
      .slice(0, compact ? 5 : undefined);
  }, [campaigns, extra, filter, sort, compact, pinned]);

  /** Clears the filter only; the chosen sort stays. */
  function clearAll() {
    setFilter("all");
  }

  function addSignature(id: string, max: number, signed: number) {
    if (signed >= max) return;
    setExtra((e) => ({ ...e, [id]: (e[id] ?? 0) + 1 }));
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("border-2 border-foreground bg-background", className)}>
        <div className="flex flex-col gap-2 bg-foreground px-4 py-2 text-background sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest">
            {compact ? "Batches on the board" : "Every batch on the board"}
          </span>
          <div className="grid grid-cols-2 gap-1 sm:flex" role="group" aria-label="Filter campaigns">
            {FILTERS.map((f) => (
              <Button
                key={f.key}
                size="sm"
                variant="ghost"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "h-11 border-background/0 px-2 text-background hover:border-background sm:h-7",
                  filter === f.key && "border-background bg-background text-foreground hover:bg-background",
                )}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-b-2 border-foreground px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="text-xs font-semibold uppercase tracking-widest">Sort</span>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="group" aria-label="Sort the board">
            {SORTS.map((s) => (
              <Button
                key={s.key}
                size="sm"
                variant={sort === s.key ? "secondary" : "outline"}
                aria-pressed={sort === s.key}
                onClick={() => setSort(s.key)}
                className="h-11 whitespace-normal px-2 sm:h-8 sm:px-3"
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>

        <ul ref={listRef} className="divide-y-2 divide-foreground">
          {rows.length === 0 && (
            <li className="p-4">
              <EmptyState
                title="No batches match this filter"
                body={`No batch is in the ${FILTERS.find((f) => f.key === filter)?.label ?? "current"} column right now. Clear the filter to see all ${campaigns.length}, sorted the way you chose.`}
                action={
                  <Button variant="outline" size="sm" className="h-11 sm:h-8" onClick={clearAll}>
                    Show all {campaigns.length}
                  </Button>
                }
              />
            </li>
          )}
          {rows.map(({ c, signed, needed }) => {
            const pct = Math.min(100, Math.round((signed / c.minOrders) * 100));
            const ready = c.status === "open" && needed === 0;
            const draft = c.id.startsWith("draft-");
            const previewed = previewId === c.id;
            return (
              <li
                key={c.id}
                className={cn(
                  "grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center",
                  previewed && "bg-muted",
                )}
              >
                <motion.div layoutId={`campaign-${c.id}`} layoutDependency={previewId ?? "none"} className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    {draft ? (
                      <span className="font-display text-lg font-bold leading-snug">{c.product}</span>
                    ) : (
                      <Link
                        href={`/pledge/${c.id}`}
                        className="font-display text-lg font-bold leading-snug underline decoration-1 underline-offset-4 hover:decoration-2"
                      >
                        {c.product}
                      </Link>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {c.maker}, {c.city}
                    </span>
                  </div>
                  <div className="mt-2 h-2.5 w-full border-2 border-foreground bg-muted" aria-hidden>
                    <div
                      className={cn("h-full bg-foreground transition-[width] duration-300", c.status === "settled" && "bg-ok", c.status === "lapsed" && "bg-muted-foreground")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm">
                    <strong>{signed} of {c.minOrders}</strong> signed at {formatTusd(c.pricePerOrder)} each.{" "}
                    {c.status === "open" && (ready ? "Threshold met, ready to collect." : `${needed} more and it collects.`)}
                    {c.status === "settled" && `Collected in one transaction.`}
                    {c.status === "lapsed" && `Closed ${formatUtc(c.deadline)}. Nobody was charged, every balance change is 0.`}
                  </p>
                </motion.div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  {c.status === "open" ? (
                    ready ? (
                      <Badge variant="ok">Ready</Badge>
                    ) : (
                      <span className="whitespace-nowrap text-xs font-semibold uppercase tracking-widest">Closes {formatUtc(c.deadline).split(",")[0]}</span>
                    )
                  ) : c.status === "settled" ? (
                    <Badge variant="ok">Collected</Badge>
                  ) : (
                    <Badge variant="secondary">Lapsed</Badge>
                  )}
                  {c.status === "open" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-11 sm:h-8"
                      disabled={signed >= c.maxOrders}
                      onClick={() => addSignature(c.id, c.maxOrders, signed)}
                      aria-label={`Add a practice signature to ${c.product}`}
                    >
                      + Sign
                    </Button>
                  )}
                  {onPreview && !draft && (
                    <Button
                      size="sm"
                      variant={previewed ? "secondary" : "outline"}
                      className="h-11 sm:h-8"
                      aria-pressed={previewed}
                      onClick={() => onPreview(previewed ? null : c.id, signed)}
                    >
                      {previewed ? "Close preview" : "Preview room"}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="border-t-2 border-foreground px-4 py-2 text-xs text-muted-foreground">
          “+ Sign” adds a practice signature on this page only. {SORT_NOTE[sort]}
        </p>
      </div>
    </MotionConfig>
  );
}
