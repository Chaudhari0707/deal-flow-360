import type { ReactNode } from "react";

import { eyebrowType } from "@/components/editorial/editorial";
import { cn } from "@/lib/utils";

/**
 * Editorial pieces for the quotation surface.
 *
 * A quotation is a commercial document, so hierarchy comes from rules, alignment and type scale
 * rather than cards, pills and shadows — the grammar the invoice pilot established. These stay
 * local to `features/quotes`; promote them to a shared module once a third surface adopts them.
 */

/** Quiet, letterspaced label type. Labels always recede behind the value they describe. */

/**
 * A control that reads as a ruled entry line instead of a boxed input. The primitive's focus ring
 * is deliberately kept: an accent underline alone is a colour-only focus signal.
 */
export const ruledControl =
  "rounded-none border-0 border-b-2 border-border-strong px-0 hover:bg-transparent focus-visible:border-ink-accent";

/** Ledger table type: letterspaced quiet headers over a rule, hairline rows, no outer box. */
export const documentHead =
  "h-auto border-b border-border-strong px-0 pt-0 pr-6 pb-2.5 text-[0.6875rem] font-medium tracking-[0.16em] text-muted-foreground uppercase last:pr-0";

export const documentCell = "border-b border-border px-0 py-3.5 pr-6 align-top last:pr-0";

/** Cells carry the rules; the row keeps no box and no fill so the ledger stays quiet. */
export const documentRow = "border-0 hover:bg-transparent";

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn(eyebrowType, "text-muted-foreground", className)}>{children}</span>;
}

/** Section rule. The index carries the rhythm of the document; the title stays quiet. */
export function SectionHead({
  children,
  index,
  title,
}: {
  children?: ReactNode;
  index?: string;
  title: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-b border-border-strong pb-3">
      <h2 className={cn(eyebrowType, "flex items-baseline gap-3 text-muted-foreground")}>
        {index ? (
          <>
            <span className="text-foreground tabular-nums">{index}</span>
            <span aria-hidden className="h-px w-6 self-center bg-border-strong" />
          </>
        ) : null}
        {title}
      </h2>
      {children ? (
        <p className="max-w-[52ch] text-xs leading-relaxed text-muted-foreground">{children}</p>
      ) : null}
    </div>
  );
}

/**
 * Head for a narrow rail column. The label sits on its own line above the note so a 320px column
 * never has to break a title and its description across each other.
 */
export function RailHead({ children, title }: { children?: ReactNode; title: string }) {
  return (
    <div className="border-b border-border-strong pb-3">
      <h2 className={cn(eyebrowType, "text-foreground")}>{title}</h2>
      {children ? <p className="mt-2 text-sm text-muted-foreground">{children}</p> : null}
    </div>
  );
}

/** One line of a totals ledger. The closing figure sits under a heavier rule. */
export function TotalLine({
  label,
  strong = false,
  value,
}: {
  label: string;
  strong?: boolean;
  value: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-8",
        strong ? "mt-1 border-t-2 border-foreground pt-3.5" : "border-b border-border py-2.5",
      )}
    >
      <dt className={strong ? cn(eyebrowType, "text-muted-foreground") : "text-muted-foreground"}>
        {label}
      </dt>
      <dd
        className={cn(
          "tabular-nums",
          strong ? "text-lg font-semibold text-foreground" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export { eyebrowType };
