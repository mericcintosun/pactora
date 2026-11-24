import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Nothing to show yet, plus the one next step as a link styled as a button. */
export function EmptyState({
  title,
  body,
  href,
  cta,
  className,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3 border-2 border-foreground bg-card p-5", className)}>
      <p className="font-display text-xl font-bold">{title}</p>
      <p className="max-w-[60ch] text-sm leading-relaxed">{body}</p>
      <Button asChild variant="outline" size="sm">
        <Link href={href}>{cta}</Link>
      </Button>
    </div>
  );
}
