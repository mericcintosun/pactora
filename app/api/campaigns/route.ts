import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/adapter";
import { HTTP_STATUS } from "@/lib/errors";
import { log } from "@/lib/log";
import type { ApiResponse, Campaign } from "@/lib/types";

export async function GET() {
  const adapter = getAdapter();
  try {
    const data = await adapter.list();
    log("campaigns.list", { mode: adapter.mode, count: data.length });
    return NextResponse.json<ApiResponse<Campaign[]>>({ ok: true, data, mode: adapter.mode });
  } catch {
    log("campaigns.list.failed", { mode: adapter.mode });
    return NextResponse.json<ApiResponse<Campaign[]>>(
      { ok: false, error: "upstream_error", hint: "Could not load the batches. Try again in a moment." },
      { status: HTTP_STATUS.upstream_error },
    );
  }
}
