import { NextResponse } from "next/server";
import { readCampaignList } from "@/lib/adapter";
import { HTTP_STATUS } from "@/lib/errors";
import { log } from "@/lib/log";
import type { ApiResponse, Campaign } from "@/lib/types";

// The board as JSON. A failed live read is served from seed data by the FALLBACK in
// lib/adapter/index.ts, and the answer then says mode "fake".
export async function GET() {
  try {
    const { data, mode, fallback } = await readCampaignList();
    log("campaigns.list", { mode, fallback, count: data.length });
    return NextResponse.json<ApiResponse<Campaign[]>>({ ok: true, data, mode });
  } catch {
    log("campaigns.list.failed", {});
    return NextResponse.json<ApiResponse<Campaign[]>>(
      { ok: false, error: "upstream_error", hint: "Could not load the batches. Try again in a moment." },
      { status: HTTP_STATUS.upstream_error },
    );
  }
}
