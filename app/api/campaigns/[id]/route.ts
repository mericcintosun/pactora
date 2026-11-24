import { NextResponse } from "next/server";
import { readCampaign } from "@/lib/adapter";
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
  const outcome = await readCampaign(parsed.data).catch(() => null);
  if (!outcome) {
    return NextResponse.json<ApiResponse<Campaign>>(
      { ok: false, error: "upstream_error", hint: "Could not load that batch. Try again in a moment." },
      { status: HTTP_STATUS.upstream_error },
    );
  }
  if (!outcome.data) {
    // A live pool id that fell back to seed data has no seed twin: say the chain was slow, not "unknown".
    return outcome.fallback
      ? NextResponse.json<ApiResponse<Campaign>>(
          { ok: false, error: "upstream_timeout", hint: "Aevum testnet did not answer in time. Try again in a moment." },
          { status: HTTP_STATUS.upstream_timeout },
        )
      : NextResponse.json<ApiResponse<Campaign>>({ ok: false, error: "invalid_input", hint: "No batch with that id." }, { status: 404 });
  }
  return NextResponse.json<ApiResponse<Campaign>>({ ok: true, data: outcome.data, mode: outcome.mode });
}
