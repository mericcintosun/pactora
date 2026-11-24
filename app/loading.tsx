import { Card, CardBar, CardContent } from "@/components/ui/card";

// Landing placeholder in the shape of the L7 hero: headline blocks, then the board on a slanted black block
// (stacked below lg, beside the headline from lg up). Static blocks only, no animation.
export default function HomeSkeleton() {
  return (
    <div role="status" aria-label="Loading the board" className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-col lg:flex-row lg:gap-12">
        <div className="space-y-4 lg:w-[44%]">
          <div className="h-4 w-40 border-2 border-foreground bg-muted" />
          <div className="h-14 w-full border-2 border-foreground bg-muted" />
          <div className="h-14 w-3/4 border-2 border-foreground bg-foreground" />
          <div className="h-24 w-full border-2 border-foreground bg-muted" />
        </div>
        <div className="pactora-slant mt-10 -mx-4 bg-foreground px-4 pb-8 pt-14 lg:mx-0 lg:mt-0 lg:w-[52%] lg:bg-transparent lg:p-0">
          <Card>
            <CardBar>Batches on the board</CardBar>
            <CardContent className="space-y-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-12 border-2 border-foreground bg-muted" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
