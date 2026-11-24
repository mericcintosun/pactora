"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

// Error boundary. Shows no error text or digest; offers a retry and a way home.
export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-24">
      <div className="max-w-2xl border-2 border-foreground">
        <p className="bg-foreground px-4 py-2 text-xs font-semibold uppercase tracking-widest text-background">Pactora</p>
        <div className="space-y-4 p-6">
          <h1 className="text-4xl font-bold">This page did not load.</h1>
          <p className="leading-relaxed">Nothing was signed and no money moved. Try again, or go back to the board.</p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => reset()}>Try again</Button>
            <Button asChild variant="outline">
              <Link href="/">Back to Pactora</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
