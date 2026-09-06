import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The one place the editorial label scale is defined.
 *
 * Under WCAG AAA a label cannot recede by going transparent — nothing below `/75` clears 7:1 on
 * the light ground — so quietness comes from size, weight, tracking and case instead. Pair this
 * with `text-muted-foreground`, which is the only quiet ink that is AAA on every surface.
 */
export const eyebrowType = "text-[0.6875rem] font-medium tracking-[0.16em] uppercase";

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn(eyebrowType, "text-muted-foreground", className)}>{children}</span>;
}
