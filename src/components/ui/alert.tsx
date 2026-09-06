import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Editorial note.
 *
 * Not a card: no box, no fill, no shadow. A single 2px marker rule on the leading edge carries the
 * tone, the title recedes to a quiet kicker, and the body is the readable line. Semantic colour is
 * taken from the AAA ink tokens so the destructive note clears 7:1 on every ground in both themes.
 */
const alertVariants = cva(
  "group/alert relative grid w-full gap-1 border-l-2 py-0.5 pl-3 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border-border-strong text-foreground",
        destructive:
          "border-ink-risk text-ink-risk *:data-[slot=alert-description]:text-ink-risk *:data-[slot=alert-title]:text-ink-risk *:[svg]:text-current",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "text-sm font-medium text-foreground group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-sm text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
        className,
      )}
      {...props}
    />
  );
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="alert-action" className={cn("absolute top-0 right-0", className)} {...props} />
  );
}

export { Alert, AlertTitle, AlertDescription, AlertAction };
