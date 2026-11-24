import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { MobileNav } from "@/components/mobile-nav";
import { NavLinks } from "@/components/nav-links";
import { Button } from "@/components/ui/button";
import { EXAMPLE_CAMPAIGN_ID } from "@/lib/data/seed";

const CTA_HREF = `/pledge?example=${EXAMPLE_CAMPAIGN_ID}`;

// HEADER row: solid ground, 2px black rule underneath, sticky. Three links plus the CTA.
// md and up: the links sit inline. Below md: one Menu disclosure (MobileNav) lists the same four.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-foreground bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex min-h-11 items-center gap-2.5">
          <BrandMark size={30} />
          <span className="font-display text-2xl font-bold">Pactora</span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-4 md:flex">
          <NavLinks liveBatchId={EXAMPLE_CAMPAIGN_ID} />
          <Button asChild variant="secondary" size="sm" className="ml-2 h-11 md:h-8">
            <Link href={CTA_HREF}>Open a batch</Link>
          </Button>
        </nav>
        <MobileNav liveBatchId={EXAMPLE_CAMPAIGN_ID} ctaHref={CTA_HREF} />
      </div>
    </header>
  );
}
