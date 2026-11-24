"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { navItems } from "@/components/nav-links";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PANEL_ID = "mobile-nav-panel";

/**
 * Below md the header collapses to one Menu disclosure. The panel drops under the 2px
 * header rule and lists all four destinations: the three header links plus the CTA.
 * The sticky header is the panel's containing block; top-[calc(100%+2px)] clears its 2px rule.
 */
export function MobileNav({ liveBatchId, ctaHref }: { liveBatchId: string; ctaHref: string }) {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  // Close the panel whenever the route changes (adopted during render, no effect).
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
  }

  const items = navItems(pathname, liveBatchId);

  return (
    <div className="md:hidden">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-11"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Close" : "Menu"}
      </Button>
      <nav
        id={PANEL_ID}
        aria-label="Main, small screens"
        hidden={!open}
        className="absolute inset-x-0 top-[calc(100%+2px)] border-b-2 border-foreground bg-background"
      >
        <ul className="mx-auto flex max-w-6xl flex-col divide-y-2 divide-foreground px-4">
          {items.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={l.active ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex min-h-11 items-center py-2 text-base font-semibold decoration-2 underline-offset-4",
                  l.active && "underline",
                )}
              >
                {l.label}
              </Link>
            </li>
          ))}
          <li className="py-3">
            <Button asChild variant="secondary" className="h-11 w-full">
              <Link href={ctaHref} onClick={() => setOpen(false)}>
                Open a batch
              </Link>
            </Button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
