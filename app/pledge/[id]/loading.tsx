import { Card, CardBar, CardContent } from "@/components/ui/card";

// Campaign room placeholder: the counter card and the signer list.
export default function CampaignRoomSkeleton() {
  return (
    <div role="status" aria-label="Loading the batch" className="mx-auto max-w-6xl px-4 py-12">
      <div className="border-b-2 border-foreground pb-6">
        <div className="h-4 w-48 border-2 border-foreground bg-muted" />
        <div className="mt-4 h-12 w-full max-w-3xl border-2 border-foreground bg-muted" />
      </div>
      <div className="mt-10 grid gap-8 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardBar>Gathering signatures</CardBar>
          <CardContent className="space-y-6">
            <div className="h-20 w-40 border-2 border-foreground bg-muted" />
            <div className="h-4 border-2 border-foreground bg-muted" />
            <div className="h-12 w-64 max-w-full border-2 border-foreground bg-foreground" />
          </CardContent>
        </Card>
        <Card className="lg:col-span-5">
          <CardBar>Who signed</CardBar>
          <CardContent className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-8 border-2 border-foreground bg-muted" />
            ))}
          </CardContent>
        </Card>
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
