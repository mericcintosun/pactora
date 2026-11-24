import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/adapter";
import type { ApiResponse, Campaign } from "@/lib/types";

export async function GET() {
  const adapter = getAdapter();
  try {
    const data = await adapter.list();
    return NextResponse.json<ApiResponse<Campaign[]>>({ ok: true, data, mode: adapter.mode });
  } catch {
    return NextResponse.json<ApiResponse<Campaign[]>>({ ok: false, error: "Could not load the batches." }, { status: 502 });
  }
}
