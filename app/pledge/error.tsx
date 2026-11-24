"use client";

import { ErrorState } from "@/components/error-state";
import { DEFAULT_HINTS } from "@/lib/errors";

// Batch desk error boundary: retry bound to Next's reset, copy from lib/errors.ts.
export default function PledgeError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-24">
      <ErrorState
        className="max-w-2xl"
        title="The batch desk did not load"
        hint={`${DEFAULT_HINTS.upstream_timeout} No batch was opened and no money moved.`}
        reset={reset}
      />
    </div>
  );
}
