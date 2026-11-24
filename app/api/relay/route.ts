// Gasless relayer endpoint. Buyers only sign; the server pays the tQDAY gas.
// Order: validate the body (zod), rate limit, mock branch, live branch.
// Mock branch: practice mode, or no relayer configured. It answers mode "mock" with a
// placeholder hash so the seed demo keeps working on any deploy.
// Live branch: lib/relayer.ts submits legacy transactions to QuorumPool / tUSD8.
import { NextResponse } from "next/server";
import { RATE_LIMIT_PER_MIN } from "@/lib/config";
import { hexFrom } from "@/lib/data/seed";
import { apiError, HTTP_STATUS, isApiError, type ApiError } from "@/lib/errors";
import { log } from "@/lib/log";
import { relayerConfigured, submitCancel, submitPledge, submitSettle, type RelayResult } from "@/lib/relayer";
import { relayBodySchema } from "@/lib/schemas";
import type { RelayOk } from "@/lib/types";

export const runtime = "nodejs";

// Best-effort per-instance rate limit per IP.
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT_PER_MIN;
}

function fail(e: ApiError) {
  return NextResponse.json(e, { status: HTTP_STATUS[e.error] });
}

export async function POST(req: Request) {
  const raw: unknown = await req.json().catch(() => undefined);
  const parsed = relayBodySchema.safeParse(raw);
  if (!parsed.success) {
    return fail(apiError("invalid_input", "The wallet address, signature, nonce or batch number is malformed."));
  }
  const body = parsed.data;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) {
    log("relay.rate_limited", { action: body.action, poolId: body.poolId });
    return fail(apiError("rate_limited"));
  }

  if (body.practice || !relayerConfigured()) {
    // Practice mode, or this deploy has no relayer key: placeholder hash, nothing on chain.
    log("relay.mock", { action: body.action, poolId: body.poolId });
    const mock: RelayOk = { mode: "mock", txHash: `0x${hexFrom(`${body.action}:${body.poolId}:${Date.now()}`, 64)}` };
    return NextResponse.json(mock);
  }

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

  if (isApiError(result)) return fail(result);
  const ok: RelayOk = { mode: "live", txHash: result.txHash, transfers: result.transfers, sellerTotal: result.sellerTotal };
  return NextResponse.json(ok);
}
