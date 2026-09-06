"use client";

import { Eyebrow, TotalLine } from "@/features/quotes/quote-editorial";
import type { calculateQuote } from "@/features/quotes/rules";
import { money } from "@/features/quotes/rules";
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
