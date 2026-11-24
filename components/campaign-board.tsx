"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { activePledges, formatTusd, formatUtc, type Campaign, type CampaignStatus } from "@/lib/data";
import { cn } from "@/lib/utils";

type Filter = "all" | CampaignStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Gathering" },
  { key: "settled", label: "Collected" },
  { key: "lapsed", label: "Lapsed" },
];

const STATUS_RANK: Record<CampaignStatus, number> = { open: 0, settled: 1, lapsed: 2 };

/**
 * Kit K7 signature 1: an auto-animated collection. Campaigns are ordered by how many
 * signatures each still needs, so adding a signature (or filtering) visibly moves rows.
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
  const [extra, setExtra] = useState<Record<string, number>>({});
  const [listRef] = useAutoAnimate<HTMLUListElement>({ duration: 260, easing: "ease-out" });

  const rows = useMemo(() => {
    return campaigns
      .map((c) => {
        const signed = activePledges(c).length + (extra[c.id] ?? 0);
        return { c, signed, needed: Math.max(c.minOrders - signed, 0) };
      })
      .filter((r) => filter === "all" || r.c.status === filter)
      .sort((a, b) => STATUS_RANK[a.c.status] - STATUS_RANK[b.c.status] || a.needed - b.needed || a.c.poolId - b.c.poolId)
      .slice(0, compact ? 5 : undefined);
  }, [campaigns, extra, filter, compact]);

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
        <div className="flex gap-1" role="group" aria-label="Filter campaigns">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant="ghost"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "h-7 border-background/0 px-2 text-background hover:border-background",
                filter === f.key && "border-background bg-background text-foreground hover:bg-background",
              )}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <ul ref={listRef} className="divide-y-2 divide-foreground">
        {rows.length === 0 && (
          <li className="px-4 py-8 text-sm">No campaigns in this state yet. Try another filter.</li>
        )}
        {rows.map(({ c, signed, needed }) => {
          const pct = Math.min(100, Math.round((signed / c.minOrders) * 100));
          const ready = c.status === "open" && needed === 0;
          return (
            <li key={c.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
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
              <div className="flex items-center gap-2 sm:justify-end">
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
        “+ Sign” adds a practice signature on this page only. Rows reorder by how many orders each batch still needs.
      </p>
    </div>
  );
}
