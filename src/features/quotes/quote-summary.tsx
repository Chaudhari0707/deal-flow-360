"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eyebrow, RailHead, TotalLine } from "@/features/quotes/quote-editorial";
import type { calculateQuote } from "@/features/quotes/rules";
import { money } from "@/features/quotes/rules";
import type { Workspace } from "@/lib/domain/_types/workspace";
import { cn } from "@/lib/utils";

/** Present calculated lines by billing period; do not mix annual and monthly charges. */
export function QuoteTotals({ totals }: { totals?: ReturnType<typeof calculateQuote> }) {
  if (!totals)
    return (
      <section aria-label="Quotation totals" className="border-t-2 border-foreground pt-6">
        <Eyebrow>Quotation totals</Eyebrow>
        <p className="mt-3 text-sm text-muted-foreground">
          Add valid quotation lines to see totals and approval requirements.
        </p>
      </section>
    );
  const intervals = [...new Set(totals.lines.map((line) => line.intervalMonths))].sort(
    (a, b) => a - b,
  );
  return (
    <section aria-label="Quotation totals" className="border-t-2 border-foreground pt-6">
      <Eyebrow>Quotation totals</Eyebrow>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Charges are grouped by billing period. Discount savings include line and order discounts
        after tier pricing. Subscription invoices may be prorated when billing starts.
      </p>
      {!intervals.includes(0) && (
        <p className="mt-3 text-sm text-muted-foreground">
          No one-time charges — all products are subscriptions.
        </p>
      )}
      {intervals.map((interval) => {
        const lines = totals.lines.filter((line) => line.intervalMonths === interval);
        const beforeDiscounts = lines.reduce(
          (sum, line) => sum + line.priceCents * line.quantity,
          0,
        );
        const subtotal = lines.reduce((sum, line) => sum + line.netCents, 0);
        const tax = lines.reduce((sum, line) => sum + line.taxCents, 0);
        const margin = lines.reduce(
          (sum, line) => sum + line.netCents - line.costCents * line.quantity,
          0,
        );
        const title =
          interval === 0
            ? "One-time charges"
            : interval === 1
              ? "Monthly charges"
              : interval === 12
                ? "Annual charges"
                : `Charges every ${interval} months`;
        return (
          <section
            key={interval}
            aria-label={title}
            className="mt-6 border-t border-border-strong pt-4"
          >
            <h3 className="text-sm font-medium">{title}</h3>
            <dl className="mt-2 text-sm">
              <TotalLine label="Before discounts" value={money(beforeDiscounts)} />
              <TotalLine label="Discount savings" value={money(beforeDiscounts - subtotal)} />
              <TotalLine label="Subtotal after discounts" value={money(subtotal)} />
              <TotalLine label="Tax" value={money(tax)} />
              <TotalLine label="Total incl. tax" value={money(subtotal + tax)} strong />
              <TotalLine label="Margin before tax" value={money(margin)} />
            </dl>
          </section>
        );
      })}
      <div className="mt-7 flex items-baseline justify-between gap-6 border-t border-border-strong pt-4">
        <Eyebrow>Approval route</Eyebrow>
        <span
          className={cn(
            "text-sm font-medium",
            totals.risk === "HIGH" ? "text-ink-risk" : "text-foreground",
          )}
        >
          {totals.risk}
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {totals.risk === "HIGH"
          ? "Manager → Finance"
          : totals.risk === "MEDIUM"
            ? "Sales Manager"
            : "Within policy · automatic approval"}
      </p>
    </section>
  );
}

/**
 * Add-ons for products already on the quote. A ruled list rather than a stack of cards, so the
 * rail reads as one column of related notes.
 */
export function QuotePairings({
  onAdd,
  onDismiss,
  pairings,
}: {
  onAdd: (id: string) => void;
  onDismiss: (id: string) => void;
  pairings: { margin: number; product: Workspace["products"][number] }[];
}) {
  return (
    <section>
      <RailHead title="Suggested pairings">
        Add-ons linked to products already on this quote. Add one to include it in the quotation.
      </RailHead>
      {pairings.length ? (
        pairings.map((entry) => (
          <div key={entry.product.id} className="border-b border-border py-4 last:border-b-0">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 text-sm text-foreground">{entry.product.name}</p>
              {entry.product.promoted && <Badge variant="outline">Promotion</Badge>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              +{money(entry.margin)} margin
              {entry.product.intervalMonths ? ` / ${entry.product.intervalMonths}mo` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-4">
              <Button
                size="sm"
                variant="outline"
                aria-label={`Add ${entry.product.name} to quote`}
                onClick={() => onAdd(entry.product.id)}
              >
                Add to quote
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Dismiss ${entry.product.name} suggestion`}
                onClick={() => onDismiss(entry.product.id)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        ))
      ) : (
        <p className="py-4 text-sm text-muted-foreground">
          Pairings appear here after you add a product that has suggested add-ons.
        </p>
      )}
    </section>
  );
}
