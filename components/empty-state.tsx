import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Nothing to show yet, plus the one next step: a link styled as a button (href + cta),
 * or a caller-supplied control (action), for example a Button that clears a filter.
 */
export function EmptyState({
  title,
  body,
  href,
  cta,
  action,
  className,
}: {
  title: string;
  body: string;
  href?: string;
  cta?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3 border-2 border-foreground bg-card p-5", className)}>
      <p className="font-display text-xl font-bold">{title}</p>
      <p className="max-w-[60ch] text-sm leading-relaxed">{body}</p>
      {action ??
        (href && cta ? (
          <Button asChild variant="outline" size="sm" className="h-11 sm:h-8">
            <Link href={href}>{cta}</Link>
          </Button>
        ) : null)}
    </div>
  );
}
