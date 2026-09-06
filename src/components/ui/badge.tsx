import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Editorial state marker.
 *
 * State reads as text in an AAA ink rather than as a coloured pill: geometry is square-ish and
 * fills stay restrained. Only `destructive` carries a square colour marker, because only it names
 * a state — `default` and `secondary` are neutral labels and counts, and a marker there costs
 * 12px in dense registers while signalling nothing. Keeping the marker on one variant also stops
 * columns that switch variant per row from shifting their text start.
 *
 * The marker lives inside that one variant: Tailwind's `--tw-content` initialises to `""`, so a
 * `before:*` utility in the base would paint an empty box on every unmarked variant.
 */
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-sm border border-transparent px-1.5 text-xs font-medium whitespace-nowrap tabular-nums transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive [a]:hover:underline [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "text-foreground",
        secondary: "text-muted-foreground",
        destructive:
          "text-ink-risk before:size-1.5 before:shrink-0 before:bg-ink-risk before:content-['']",
        outline: "border-border-strong text-foreground",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted/50",
        link: "text-ink-accent underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props,
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants };
