// Gasless relayer endpoint. Buyers only sign; the server pays the tQDAY gas.
// Order: validate the body (zod), rate limit, idempotency, mock branch, live branch.
// Mock branch: practice mode only (the client sends practice: true for seed batches).
// It answers mode "mock" with a placeholder hash, nothing goes on chain.
// Live branch: lib/relayer.ts submits legacy transactions to QuorumPool / tUSD8. A live
// request on a deploy without a relayer key answers not_configured; it never turns
// into a mock hash.
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { RATE_LIMIT_PER_MIN } from "@/lib/config";
import { hexFrom } from "@/lib/data/seed";
import { apiError, HTTP_STATUS, isApiError, type ApiError } from "@/lib/errors";
import { log } from "@/lib/log";
import { relayerConfigured, submitCancel, submitPledge, submitSettle, type RelayResult } from "@/lib/relayer";
import { relayBodySchema, type RelayBody } from "@/lib/schemas";
import type { RelayOk } from "@/lib/types";

export const runtime = "nodejs";

// ---------------------------------------------------------------- RATE LIMIT
// Best-effort per-instance rate limit per IP.
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT_PER_MIN;
}

// --------------------------------------------------------------- IDEMPOTENCY
// Best effort, per server instance: two Vercel instances do not share these maps, and a
// cold start forgets them. The real backstop is the contract: a second pledge with the
// same nonce reverts NonceUsed or AlreadyPledged, a second settle reverts PoolClosed,
// and lib/relayer.ts maps those through REVERT_HINTS before anything is sent.
//
// inFlight: a request with the same key that arrives while the first is still running
// waits for the first one's promise instead of submitting a second transaction.
// settledResults: a successful outcome is replayed for IDEMPOTENCY_TTL_MS. Failures are
// not cached, so "Try again" with the same key really tries again.
const inFlight = new Map<string, Promise<RelayResult | ApiError>>();
const settledResults = new Map<string, { at: number; result: RelayResult }>();
const IDEMPOTENCY_TTL_MS = 10 * 60_000;
const IDEMPOTENCY_MAX_ENTRIES = 500;

function sweepSettled(now: number) {
  for (const [key, entry] of settledResults) {
    if (now - entry.at > IDEMPOTENCY_TTL_MS || settledResults.size > IDEMPOTENCY_MAX_ENTRIES) settledResults.delete(key);
  }
}

async function onceFor(idempotencyKey: string | null, run: () => Promise<RelayResult | ApiError>): Promise<RelayResult | ApiError> {
  if (!idempotencyKey) return run();
  const now = Date.now();
  sweepSettled(now);
  const done = settledResults.get(idempotencyKey);
  if (done) {
    log("relay.replayed", { key: idempotencyKey });
    return done.result;
  }
  const pending = inFlight.get(idempotencyKey);
  if (pending) {
    log("relay.joined", { key: idempotencyKey });
    return pending;
  }
  const p = run()
    .then((result) => {
      if (!isApiError(result)) settledResults.set(idempotencyKey, { at: Date.now(), result });
      return result;
    })
    .finally(() => inFlight.delete(idempotencyKey));
  inFlight.set(idempotencyKey, p);
  return p;
}

// ------------------------------------------------------------------ branches

async function mockBranch(body: RelayBody): Promise<RelayResult> {
  log("relay.mock", { action: body.action, poolId: body.poolId });
  return { txHash: `0x${hexFrom(`${body.action}:${body.poolId}:${Date.now()}`, 64)}` };
}

async function liveBranch(body: RelayBody): Promise<RelayResult | ApiError> {
  if (!relayerConfigured()) return apiError("not_configured");
  const t0 = Date.now();
  let result: RelayResult | ApiError;
  if (body.action === "pledge") {
    result = await submitPledge(body);
  } else if (body.action === "cancel") {
    result = await submitCancel(body);
  } else {
    result = await submitSettle(body);
  }
  log("relay.done", { action: body.action, poolId: body.poolId, ok: !isApiError(result), ms: Date.now() - t0 });
  if (!isApiError(result)) {
    // The chain changed: drop the cached render of this pool's page and the board.
    try {
      revalidatePath(`/pledge/${body.poolId}`);
      revalidatePath("/");
    } catch {
      // Revalidation is a speed-up only; the pages also re-render every 5 and 30 seconds.
    }
  }
  return result;
}

function fail(e: ApiError) {
  return NextResponse.json(e, { status: HTTP_STATUS[e.error] });
}

export async function POST(req: Request) {
  const raw: unknown = await req.json().catch(() => undefined);
  const parsed = relayBodySchema.safeParse(raw);
  if (!parsed.success) {
    return fail(apiError("invalid_input", "The wallet address, signature, nonce, batch number or request key is malformed."));
  }
  const body = parsed.data;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) {
    log("relay.rate_limited", { action: body.action, poolId: body.poolId });
    return fail(apiError("rate_limited"));
  }

  const mock = body.practice === true;
  // Mock and live keys live in separate namespaces so a practice click never replays a live hash.
  const key = body.idempotencyKey ? `${mock ? "mock" : "live"}:${body.idempotencyKey}` : null;
  const result = await onceFor(key, () => (mock ? mockBranch(body) : liveBranch(body)));

  if (isApiError(result)) return fail(result);
  const ok: RelayOk = {
    mode: mock ? "mock" : "live",
    txHash: result.txHash,
    transfers: result.transfers,
    sellerTotal: result.sellerTotal,
  };
  return NextResponse.json(ok);
}
