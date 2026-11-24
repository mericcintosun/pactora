"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * One failure block with a retry. Route error boundaries pass Next's `reset`; the
 * campaign room and the batch desk pass a function that re-sends the same request
 * with the same idempotency key. Copy comes from the hints in lib/errors.ts, never
 * from a stack trace or provider text.
 */
export function ErrorState({
  title,
  hint,
  reset,
  children,
  className,
}: {
  title: string;
  hint: string;
  reset: () => void;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("border-2 border-foreground bg-background", className)}>
      <p className="bg-foreground px-4 py-2 text-xs font-semibold uppercase tracking-widest text-background">{title}</p>
      <div className="space-y-3 p-4">
        <p className="leading-relaxed">{hint}</p>
        {children}
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => reset()}>
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
