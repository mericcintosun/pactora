// The only file that reads ADAPTER_MODE. Server only: pages and API routes call
// readCampaignList() / readCampaign() (or getAdapter() for writes) and pass `mode`
// down to client components as a prop.
import { PAGE_READ_BUDGET_MS, parseAdapterMode, type AdapterMode } from "@/lib/config";
import type { ErrorCode } from "@/lib/errors";
import { toCallError, withBudget } from "@/lib/http";
import { log } from "@/lib/log";
import type { Campaign } from "@/lib/types";
import { fakeAdapter } from "./fake";
import { realAdapter } from "./real";
import type { CampaignAdapter } from "./types";

export type { AdapterMode, BatchDraftInput, CampaignAdapter, TxResult } from "./types";

/**
 * Real only when ADAPTER_MODE is exactly "real" AND NEXT_PUBLIC_CONTRACT_ADDRESS is set.
 * Anything else is the fake seed adapter, so a half-configured deploy never breaks the demo.
 */
export function getAdapter(): CampaignAdapter {
  return parseAdapterMode(process.env.ADAPTER_MODE) === "real" ? realAdapter : fakeAdapter;
}

/** A page read plus where it really came from. `fallback` is true when a real read failed and seed data was served. */
export interface ReadOutcome<T> {
  data: T;
  mode: AdapterMode;
  fallback: boolean;
}

// FALLBACK: when the real adapter's read times out (or passes PAGE_READ_BUDGET_MS) or
// fails with upstream_error or parse_failure, the request is served from the fake
// adapter in lib/adapter/fake.ts (seed data from lib/data/seed.ts). The outcome then
// says mode "fake" and fallback true, so ModeLine prints the sample-data sentence for
// that page and the client components run in practice mode. Only reads fall back:
// a failed relay write renders tx-failed with a retry, never a mock hash.
const FALLBACK_CODES: ReadonlySet<ErrorCode> = new Set<ErrorCode>(["upstream_timeout", "upstream_error", "parse_failure"]);

async function withFallback<T>(what: string, real: () => Promise<T>, fake: () => Promise<T>): Promise<ReadOutcome<T>> {
  const adapter = getAdapter();
  if (adapter.mode === "fake") return { data: await fake(), mode: "fake", fallback: false };
  const t0 = Date.now();
  try {
    const data = await withBudget(real(), PAGE_READ_BUDGET_MS);
    return { data, mode: "real", fallback: false };
  } catch (err) {
    const code = toCallError(err).code;
    if (!FALLBACK_CODES.has(code)) throw err;
    log("adapter.fallback", { what, code, ms: Date.now() - t0 });
    return { data: await fake(), mode: "fake", fallback: true };
  }
}

/** The board: live pools plus seed batches, or seed only on fallback. */
export function readCampaignList(): Promise<ReadOutcome<Campaign[]>> {
  return withFallback("list", () => realAdapter.list(), () => fakeAdapter.list());
}

/** One batch page. Seed slugs resolve in every mode; a live pool id that falls back resolves to null. */
export function readCampaign(id: string): Promise<ReadOutcome<Campaign | null>> {
  return withFallback(`get:${id}`, () => realAdapter.get(id), () => fakeAdapter.get(id));
}
