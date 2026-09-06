import type { PublicQuote } from "@/features/portal/_types/portal";
import { TotalLine } from "@/features/quotes/quote-editorial";
import { money } from "@/lib/money";

/** Sum saved, already-rounded public line amounts; never reprice an accepted quotation. */
export function portalChargeGroups(lines: PublicQuote["lines"]) {
  return [...new Set(lines.map((line) => line.intervalMonths))]
    .sort((a, b) => a - b)
    .map((intervalMonths) => {
      const group = lines.filter((line) => line.intervalMonths === intervalMonths);
      const beforeDiscountsCents = group.reduce(
        (sum, line) => sum + line.priceCents * line.quantity,
        0,
      );
      const subtotalCents = group.reduce((sum, line) => sum + line.netCents, 0);
      return {
        intervalMonths,
        title:
          intervalMonths === 0
            ? "One-time charges"
            : intervalMonths === 1
              ? "Monthly charges"
              : intervalMonths === 12
                ? "Annual charges"
                : `Charges every ${intervalMonths} months`,
        beforeDiscountsCents,
        discountCents: beforeDiscountsCents - subtotalCents,
        subtotalCents,
        taxCents: group.reduce((sum, line) => sum + line.taxCents, 0),
        totalCents: group.reduce((sum, line) => sum + line.totalCents, 0),
      };
    });
}

export function PortalQuoteTotals({
  lines,
  orderDiscountBps,
}: Pick<PublicQuote, "lines" | "orderDiscountBps">) {
  const groups = portalChargeGroups(lines);
  if (!groups.length)
    return <p className="text-sm text-muted-foreground">This quotation has no line items.</p>;
  return (
    <section aria-label="Quotation price breakdown" className="space-y-6 text-sm">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Savings include line discounts and the {orderDiscountBps / 100}% order discount, applied
        after your tier pricing. Charges with different billing periods are shown separately.
      </p>
      {!groups.some((group) => group.intervalMonths === 0) && (
        <p className="text-muted-foreground">
          No one-time charges — all products are subscriptions.
        </p>
      )}
      {groups.map((group) => (
        <section key={group.intervalMonths} aria-label={group.title}>
          <h3 className="border-b border-border-strong pb-3 font-medium text-foreground">
            {group.title}
          </h3>
          <dl>
            <TotalLine label="Before discounts" value={money(group.beforeDiscountsCents)} />
            <TotalLine label="Discount savings" value={money(group.discountCents)} />
            <TotalLine label="Subtotal after discounts" value={money(group.subtotalCents)} />
            <TotalLine label="Tax" value={money(group.taxCents)} />
            <TotalLine label="Total incl. tax" value={money(group.totalCents)} strong />
          </dl>
        </section>
      ))}
      {groups.some((group) => group.intervalMonths > 0) && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Subscription amounts are for a full billing period. The first invoice may be prorated
          based on the billing start date; these totals are not an amount due today.
        </p>
      )}
    </section>
  );
}
