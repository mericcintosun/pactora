import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-24">
      <div className="max-w-2xl border-2 border-foreground">
        <p className="bg-foreground px-4 py-2 text-xs font-semibold uppercase tracking-widest text-background">Pactora</p>
        <div className="space-y-4 p-6">
          <h1 className="text-4xl font-bold">No batch at this address.</h1>
          <p className="leading-relaxed">The link may be old, or the batch was never opened.</p>
          <Button asChild>
            <Link href="/">Back to Pactora</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
