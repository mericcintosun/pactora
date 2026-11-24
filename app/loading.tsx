import { Card, CardBar, CardContent } from "@/components/ui/card";

// Landing placeholder: headline blocks on the left, the board frame on the right.
export default function HomeSkeleton() {
  return (
    <div role="status" aria-label="Loading the board" className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-col gap-12 lg:flex-row">
        <div className="space-y-4 lg:w-[44%]">
          <div className="h-4 w-40 border-2 border-foreground bg-muted" />
          <div className="h-14 w-full border-2 border-foreground bg-muted" />
          <div className="h-14 w-3/4 border-2 border-foreground bg-foreground" />
          <div className="h-24 w-full border-2 border-foreground bg-muted" />
        </div>
        <Card className="lg:ml-auto lg:w-[52%]">
          <CardBar>Batches gathering now</CardBar>
          <CardContent className="space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 border-2 border-foreground bg-muted" />
            ))}
          </CardContent>
        </Card>
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
