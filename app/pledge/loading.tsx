import { Card, CardBar, CardContent } from "@/components/ui/card";

// Workspace placeholder: the batch form on the left, the board on the right.
export default function PledgeSkeleton() {
  return (
    <div role="status" aria-label="Loading the batch desk" className="mx-auto max-w-6xl px-4 py-12">
      <div className="border-b-2 border-foreground pb-6">
        <div className="h-12 w-72 max-w-full border-2 border-foreground bg-muted" />
        <div className="mt-4 h-6 w-full max-w-2xl border-2 border-foreground bg-muted" />
      </div>
      <div className="mt-10 grid gap-10 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardBar>Open a batch</CardBar>
          <CardContent className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 border-2 border-foreground bg-muted" />
            ))}
          </CardContent>
        </Card>
        <Card className="lg:col-span-7">
          <CardBar>Every batch on the board</CardBar>
          <CardContent className="space-y-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 border-2 border-foreground bg-muted" />
            ))}
          </CardContent>
        </Card>
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
