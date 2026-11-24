import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/adapter";
import { HTTP_STATUS } from "@/lib/errors";
import { campaignIdSchema } from "@/lib/schemas";
import type { ApiResponse, Campaign } from "@/lib/types";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = campaignIdSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json<ApiResponse<Campaign>>(
      { ok: false, error: "invalid_input", hint: "Batch ids are a slug or a pool number." },
      { status: HTTP_STATUS.invalid_input },
    );
  }
  const adapter = getAdapter();
  const data = await adapter.get(parsed.data).catch(() => null);
  if (!data) {
    return NextResponse.json<ApiResponse<Campaign>>(
      { ok: false, error: "invalid_input", hint: "No batch with that id." },
      { status: 404 },
    );
  }
  return NextResponse.json<ApiResponse<Campaign>>({ ok: true, data, mode: adapter.mode });
}
