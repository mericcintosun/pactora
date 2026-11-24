import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/adapter";
import type { ApiResponse, Campaign } from "@/lib/types";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adapter = getAdapter();
  const data = await adapter.get(id).catch(() => null);
  if (!data) {
    return NextResponse.json<ApiResponse<Campaign>>({ ok: false, error: "No batch with that id." }, { status: 404 });
  }
  return NextResponse.json<ApiResponse<Campaign>>({ ok: true, data, mode: adapter.mode });
}
