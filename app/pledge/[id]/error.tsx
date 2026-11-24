"use client";

import Link from "next/link";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { DEFAULT_HINTS } from "@/lib/errors";

// Campaign page error boundary: a live pool read that failed with no seed fallback lands
// here. Retry is bound to Next's reset; copy comes from lib/errors.ts.
export default function CampaignError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-24">
      <ErrorState
        className="max-w-2xl"
        title="This batch did not load"
        hint={`${DEFAULT_HINTS.upstream_timeout} Your signature, if you gave one, is unchanged.`}
        reset={reset}
      >
        <Button asChild variant="outline">
          <Link href="/pledge/kavruk-guji">Open the example batch</Link>
        </Button>
      </ErrorState>
    </div>
  );
}
