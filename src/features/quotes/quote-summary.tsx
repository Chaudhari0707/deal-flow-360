"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eyebrow, RailHead, TotalLine } from "@/features/quotes/quote-editorial";
import type { calculateQuote } from "@/features/quotes/rules";
import { money } from "@/features/quotes/rules";
import type { Workspace } from "@/lib/domain/_types/workspace";
import { cn } from "@/lib/utils";

/**
 * The closing figures of the working quotation. Numbers are the primary visual element: the
 * one-time total is set large and tabular, the ledger under it is ruled line by line, and the
 * approval route reads as quiet text with the risk ink reserved for a real escalation.
 */
export function QuoteTotals({ totals }: { totals?: ReturnType<typeof calculateQuote> }) {
  const recurring = totals?.lines.filter((line) => line.intervalMonths > 0) ?? [];
  return (
    <section className="border-t-2 border-foreground pt-6">
      <Eyebrow>One-time total</Eyebrow>
      <p className="mt-3 text-[1.75rem] leading-none font-medium tracking-tight text-foreground tabular-nums">
        {money(totals?.totalCents ?? 0)}
      </p>
      <dl className="mt-7 text-sm">
        <TotalLine label="Subtotal" value={money(totals?.subtotalCents ?? 0)} />
        <TotalLine label="Tax" value={money(totals?.taxCents ?? 0)} />
        <TotalLine label="One-time margin" value={money(totals?.marginCents ?? 0)} />
        {recurring.map((line) => (
          <TotalLine
            key={line.id}
            label={line.name}
            value={`${money(line.totalCents)} / ${line.intervalMonths}mo`}
          />
        ))}
      </dl>
      <div className="mt-7 flex items-baseline justify-between gap-6 border-t border-border-strong pt-4">
        <Eyebrow>Approval route</Eyebrow>
        <span
          className={cn(
            "text-sm font-medium",
            totals?.risk === "HIGH" ? "text-ink-risk" : "text-foreground",
          )}
        >
          {totals?.risk ?? "—"}
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {totals?.risk === "HIGH"
          ? "Manager → Finance"
          : totals?.risk === "MEDIUM"
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
