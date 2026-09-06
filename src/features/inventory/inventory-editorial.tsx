import type { ReactNode } from "react";

import { eyebrowType } from "@/components/editorial/editorial";
import type { DataTableClassNames } from "@/components/ui/data-table";
import { displayFulfillmentStatus } from "@/features/inventory/fulfillment-copy";
import { cn } from "@/lib/utils";

/**
 * DealFlow360 editorial design language — inventory and fulfillment.
 *
 * Operational surfaces are the densest in the product, so hierarchy comes from rules, alignment
 * and type scale rather than cards, pills or shadows. Quiet type earns its quietness from size,
 * case and letter-spacing; transparency is never used for ink, because nothing below
 * `text-foreground/75` clears AAA against the light page ground.
 *
 * These pieces stay local to the inventory feature until a second feature adopts them.
 */

/** Quiet, letterspaced label type. Tracking belongs to labels; values stay untracked. */

/** Form label type across the inventory dialogs. */
export const fieldLabel = cn(eyebrowType, "text-muted-foreground");

/** Numbers are the primary visual element: right-aligned, tabular, comparable at a glance. */
export const numericCell = "block text-right tabular-nums";

/** A summary figure. Large, tight and tabular so counts compare across the band. */
export const figureValue =
  "text-2xl leading-none font-medium tracking-tight text-foreground tabular-nums";

/**
 * The table primitive already rules the header, letterspaces its labels and paints hairline rows.
 * This only removes the outer box, flushes the columns to the page measure and tightens the type
 * to an operational density — it deliberately does not restate what the primitive already does.
 */
export const operationalTable: DataTableClassNames = {
  cell: "px-0 py-3 pr-8 last:pr-0",
  emptyCell: "px-0",
  head: "px-0 pr-8 last:pr-0",
  row: "border-0",
  table: "text-[0.8125rem]",
};

/** The same chrome at dialog density. */
export const compactHead = "px-0 pr-6 last:pr-0";
export const compactCell = "px-0 py-2 pr-6 last:pr-0";

function fulfillmentTone(status: string) {
  if (status === "BACKORDER") return { mark: "bg-ink-risk", text: "text-ink-risk" };
  if (status === "FULFILLED") return { mark: "bg-ink-positive", text: "text-ink-positive" };
  return { mark: "bg-muted-foreground", text: "text-foreground" };
}

/** State as a square marker plus an AAA ink — never a coloured pill. */
export function StatusMark({ prominent = false, status }: { prominent?: boolean; status: string }) {
  const tone = fulfillmentTone(status);
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap",
        prominent ? "gap-2.5 text-lg leading-none font-medium tracking-tight" : "gap-2",
      )}
    >
      <span aria-hidden className={cn("shrink-0", prominent ? "size-2" : "size-1.5", tone.mark)} />
      <span className={tone.text}>{displayFulfillmentStatus(status)}</span>
    </span>
  );
}

/** A section opens on a rule: letterspaced kicker, then the standing explanation beneath it. */
export function SectionHead({
  description,
  level,
  title,
}: {
  description: string;
  level: "h2" | "h3";
  title: string;
}) {
  const Heading = level;
  return (
    <div className="border-b border-border-strong pb-3">
      <Heading className={cn(eyebrowType, "text-foreground")}>{title}</Heading>
      <p className="mt-2 max-w-[68ch] text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

/** Summary counts share one hairline-divided band instead of a grid of bordered tiles. */
export function FigureBand({
  compact,
  items,
}: {
  compact: boolean;
  items: { label: string; note?: string; value: ReactNode }[];
}) {
  return (
    <dl className="grid grid-cols-1 divide-y divide-border border-y border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      {items.map((item) => (
        <div
          key={item.label}
          className={cn("sm:px-6 sm:first:pl-0 sm:last:pr-0", compact ? "py-4" : "py-6")}
        >
          <dt className={cn(eyebrowType, "text-muted-foreground")}>{item.label}</dt>
          <dd className="mt-2.5">
            {item.value}
            {item.note ? <p className="mt-2.5 text-xs text-muted-foreground">{item.note}</p> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export { eyebrowType };
