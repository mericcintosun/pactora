import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Pressroom buttons: square corners, 2px black rule, uppercase Franklin, no soft shadows.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none border-2 border-foreground text-sm font-semibold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-primary bg-primary text-primary-foreground hover:bg-foreground hover:border-foreground",
        secondary: "bg-foreground text-background hover:bg-background hover:text-foreground",
        outline: "bg-background text-foreground hover:bg-foreground hover:text-background",
        ghost: "border-transparent hover:border-foreground",
        destructive: "border-destructive bg-background text-destructive hover:bg-destructive hover:text-destructive-foreground",
        link: "border-transparent px-0 normal-case tracking-normal underline decoration-2 underline-offset-4 hover:decoration-primary",
      },
      // Below sm every size keeps a 44px touch target (min-h-11); from sm up the desktop heights apply.
      size: {
        default: "h-10 min-h-11 px-4 sm:min-h-0",
        sm: "h-8 min-h-11 px-3 text-xs sm:min-h-0",
        lg: "h-12 px-7 text-base",
        icon: "h-10 w-10 min-h-11 min-w-11 sm:min-h-0 sm:min-w-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
