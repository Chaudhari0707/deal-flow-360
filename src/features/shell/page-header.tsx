import type { ReactNode } from "react";

import { eyebrowType } from "@/components/editorial/editorial";
import { cn } from "@/lib/utils";

/**
 * Editorial masthead. Shared by every workspace and portal screen.
 *
 * Hierarchy comes from a strong top rule, a quiet letterspaced kicker, a large tight-tracked
 * title and a lede held to a readable measure — never from a card, a shadow or faded ink. The
 * scale steps up one notch from the previous header so operational registers still breathe.
 */

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="border-t-2 border-foreground pt-6">
      <div className="flex flex-col gap-x-10 gap-y-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <span className={cn(eyebrowType, "block text-muted-foreground")}>{eyebrow}</span>
          ) : (
            <span aria-hidden className="block h-0.5 w-7 bg-ink-accent" />
          )}
          <h1 className="mt-4 text-3xl leading-[1.1] font-semibold tracking-tight text-foreground md:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-[56ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
