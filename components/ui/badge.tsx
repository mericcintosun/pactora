import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Pressroom stamps: square, ruled, uppercase. State colors only for state.
const badgeVariants = cva(
  "inline-flex items-center rounded-none border-2 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-widest",
  {
    variants: {
      variant: {
        default: "border-foreground bg-foreground text-background",
        secondary: "border-foreground bg-muted text-foreground",
        outline: "border-foreground text-foreground",
        destructive: "border-bad text-bad",
        ok: "border-ok bg-ok text-background",
        warn: "border-warn text-warn",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

function Badge({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
