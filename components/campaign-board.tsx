"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
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
 * Kit K7 signature 3: the inline sort. "board" is the server-rendered order (status, then
 * fewest signatures still needed), so the HTML reads the same with JavaScript off. The
 * other keys sort on real Campaign fields only: minOrders minus active pledges, deadline,
 * pricePerOrder. Ties fall back to the pool number, never to chance.
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
  board: "Rows reorder by how many orders each batch still needs.",
  needed: "Sorted by signatures still needed, most first.",
  deadline: "Sorted by deadline: gathering batches closing soonest first, then closed ones.",
  price: "Sorted by price per order, cheapest first.",
};

/**
 * Kit K7 signature 1: an auto-animated collection. Campaigns are ordered by how many
 * signatures each still needs, so adding a signature (or filtering) visibly moves rows.
 * Outside the compact home view it also carries signature 3, the sort control above.
 */
export function CampaignBoard({
  campaigns,
  compact = false,
  className,
}: {
  campaigns: Campaign[];
  compact?: boolean;
  className?: string;
}) {
  const [filter, setFilter] = useState<Filter>(compact ? "open" : "all");
  const [sort, setSort] = useState<SortKey>("board");
  const [extra, setExtra] = useState<Record<string, number>>({});
  const [listRef] = useAutoAnimate<HTMLUListElement>({ duration: 260, easing: "ease-out" });

  const rows = useMemo(() => {
    return campaigns
      .map((c): Row => {
        const signed = activePledges(c).length + (extra[c.id] ?? 0);
        return { c, signed, needed: Math.max(c.minOrders - signed, 0) };
      })
      .filter((r) => filter === "all" || r.c.status === filter)
      .sort(COMPARE[sort])
      .slice(0, compact ? 5 : undefined);
  }, [campaigns, extra, filter, sort, compact]);

  /** Clears the filter only; the chosen sort stays. */
  function clearAll() {
    setFilter("all");
  }

  function addSignature(id: string, max: number, signed: number) {
    if (signed >= max) return;
    setExtra((e) => ({ ...e, [id]: (e[id] ?? 0) + 1 }));
  }

  return (
    <div className={cn("border-2 border-foreground bg-background", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 bg-foreground px-4 py-2 text-background">
        <span className="text-xs font-semibold uppercase tracking-widest">
          {compact ? "Batches gathering now" : "Every batch on the board"}
        </span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter campaigns">
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

      {!compact && (
        <div className="flex flex-col gap-2 border-b-2 border-foreground px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="text-xs font-semibold uppercase tracking-widest">Sort</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Sort campaigns">
            {SORTS.map((s) => (
              <Button
                key={s.key}
                size="sm"
                variant={sort === s.key ? "secondary" : "outline"}
                aria-pressed={sort === s.key}
                onClick={() => setSort(s.key)}
                className="h-11 sm:h-8"
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <ul ref={listRef} className="divide-y-2 divide-foreground">
        {rows.length === 0 && (
          <li className="p-4">
            <EmptyState
              title="No batches match this sort"
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
          return (
            <li key={c.id} className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-[1fr_auto] md:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  {c.id.startsWith("draft-") ? (
                    <span className="font-display text-lg font-bold leading-snug">{c.product}</span>
                  ) : (
                    <Link href={`/pledge/${c.id}`} className="font-display text-lg font-bold leading-snug underline-offset-4 hover:underline">
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
                  {c.status === "lapsed" && `Closed ${formatUtc(c.deadline)}. Nobody was charged.`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                {c.status === "open" ? (
                  ready ? <Badge variant="ok">Ready</Badge> : <Badge variant="outline">Closes {formatUtc(c.deadline).split(",")[0]}</Badge>
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
              </div>
            </li>
          );
        })}
      </ul>
      <p className="border-t-2 border-foreground px-4 py-2 text-xs text-muted-foreground">
        “+ Sign” adds a practice signature on this page only. {SORT_NOTE[sort]}
      </p>
    </div>
  );
}
