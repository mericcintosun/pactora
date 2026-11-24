"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string; active: boolean };

/** The three header destinations with their active state. Shared by the desktop links and MobileNav. */
export function navItems(pathname: string, liveBatchId: string): NavItem[] {
  const liveHref = `/pledge/${liveBatchId}`;
  return [
    { href: "/pledge", label: "Campaigns", active: pathname === "/pledge" || (pathname.startsWith("/pledge/") && pathname !== liveHref) },
    { href: liveHref, label: "Live batch", active: pathname === liveHref },
    { href: "/how", label: "How it works", active: pathname === "/how" || pathname.startsWith("/how/") },
  ];
}

/**
 * Desktop header links (md and up; the parent nav is `hidden md:flex`) with the active
 * route marked by aria-current and a visible 2px underline.
 */
export function NavLinks({ liveBatchId }: { liveBatchId: string }) {
  const pathname = usePathname() ?? "/";

  return (
    <>
      {navItems(pathname, liveBatchId).map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={l.active ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 items-center text-sm font-semibold decoration-2 underline-offset-4 hover:underline",
            l.active && "underline",
          )}
        >
          {l.label}
        </Link>
      ))}
    </>
  );
}
