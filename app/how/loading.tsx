import { Card, CardBar, CardContent } from "@/components/ui/card";

// Method page placeholder: the headline column, the signed-message block and the controls grid.
export default function HowSkeleton() {
  return (
    <div role="status" aria-label="Loading the contract rules" className="mx-auto max-w-6xl px-4 py-12">
      <div className="grid gap-10 border-b-2 border-foreground pb-10 md:grid-cols-12">
        <div className="space-y-4 md:col-span-7">
          <div className="h-14 w-full border-2 border-foreground bg-muted" />
          <div className="h-28 w-full border-2 border-foreground bg-muted" />
        </div>
        <div className="h-48 border-2 border-foreground bg-muted md:col-span-5" />
      </div>
      <div className="mt-14 h-40 border-2 border-foreground bg-muted" />
      <Card className="mt-14">
        <CardBar>Controls a buyer can rely on</CardBar>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 border-2 border-foreground bg-muted" />
          ))}
        </CardContent>
      </Card>
      <span className="sr-only">Loading</span>
    </div>
  );
}
