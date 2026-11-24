import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { EXAMPLE_CAMPAIGN_ID } from "@/lib/data";

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
          <Link href="/pledge" className="hidden text-sm font-semibold underline-offset-4 hover:underline sm:inline">
            Campaigns
          </Link>
          <Link href={`/pledge/${EXAMPLE_CAMPAIGN_ID}`} className="hidden text-sm font-semibold underline-offset-4 hover:underline md:inline">
            Live batch
          </Link>
          <Link href="/how" className="text-sm font-semibold underline-offset-4 hover:underline">
            How it works
          </Link>
          <Button asChild variant="secondary" size="sm" className="ml-2">
            <Link href={`/pledge?example=${EXAMPLE_CAMPAIGN_ID}`}>Open a batch</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
