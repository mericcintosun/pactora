import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { NavLinks } from "@/components/nav-links";
import { Button } from "@/components/ui/button";
import { EXAMPLE_CAMPAIGN_ID } from "@/lib/data/seed";

// HEADER row: solid ground, 2px black rule underneath, sticky. Three links plus the CTA.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-foreground bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark size={30} />
          <span className="font-display text-2xl font-bold">Pactora</span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-4">
          <NavLinks liveBatchId={EXAMPLE_CAMPAIGN_ID} />
          <Button asChild variant="secondary" size="sm" className="ml-2">
            <Link href={`/pledge?example=${EXAMPLE_CAMPAIGN_ID}`}>Open a batch</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
