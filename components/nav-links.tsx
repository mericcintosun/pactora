"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Header links with the active route marked by aria-current and a visible 2px underline. */
export function NavLinks({ liveBatchId }: { liveBatchId: string }) {
  const pathname = usePathname() ?? "/";
  const liveHref = `/pledge/${liveBatchId}`;

  const links = [
    { href: "/pledge", label: "Campaigns", active: pathname === "/pledge" || (pathname.startsWith("/pledge/") && pathname !== liveHref), className: "hidden sm:inline" },
    { href: liveHref, label: "Live batch", active: pathname === liveHref, className: "hidden md:inline" },
    { href: "/how", label: "How it works", active: pathname === "/how" || pathname.startsWith("/how/"), className: "inline" },
  ];

  return (
    <>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={l.active ? "page" : undefined}
          className={cn(
            "text-sm font-semibold decoration-2 underline-offset-4 hover:underline",
            l.active && "underline",
            l.className,
          )}
        >
          {l.label}
        </Link>
      ))}
    </>
  );
}
