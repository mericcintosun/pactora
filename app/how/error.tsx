"use client";

import { ErrorState } from "@/components/error-state";
import { DEFAULT_HINTS } from "@/lib/errors";

// Method page error boundary: retry bound to Next's reset, copy from lib/errors.ts.
export default function HowError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-24">
      <ErrorState
        className="max-w-2xl"
        title="The contract rules did not load"
        hint={DEFAULT_HINTS.upstream_error}
        reset={reset}
      />
    </div>
  );
}
