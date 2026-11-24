import * as React from "react";
import { cn } from "@/lib/utils";

// Pressroom cards: a 2px black frame on newsprint, square corners, and an optional
// solid black headline bar with reversed type (CardBar).
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-none border-2 border-foreground bg-background text-card-foreground", className)} {...props} />;
}
function CardBar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-wrap items-center justify-between gap-x-3 gap-y-1 bg-foreground px-4 py-2 text-xs font-semibold uppercase tracking-widest text-background", className)}
      {...props}
    />
  );
}
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 border-b-2 border-foreground p-5", className)} {...props} />;
}
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("font-display text-xl font-bold leading-tight", className)} {...props} />;
}
function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-sm text-muted-foreground", className)} {...props} />;
}
function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}
function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-3 border-t-2 border-foreground p-5", className)} {...props} />;
}

export { Card, CardBar, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
