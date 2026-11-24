"use client";

import Link from "next/link";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { DEFAULT_HINTS } from "@/lib/errors";

// Root error boundary (covers /). Shows no error text or digest: copy comes from the
// error taxonomy hints, plus a retry bound to Next's reset and a way home.
export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-24">
      <ErrorState
        className="max-w-2xl"
        title="This page did not load"
        hint={`${DEFAULT_HINTS.upstream_error} Nothing was signed and no money moved.`}
        reset={reset}
      >
        <Button asChild variant="outline">
          <Link href="/">Back to Pactora</Link>
        </Button>
      </ErrorState>
    </div>
  );
}
