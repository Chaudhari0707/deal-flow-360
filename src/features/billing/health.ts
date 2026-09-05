import { actualDays, invoiceOutstanding } from "@/features/billing/rules";
import type { Workspace } from "@/lib/domain/_types/workspace";

export function dealHealth(data: Workspace, now = new Date()) {
  const rules = data.settings.find((setting) => setting.id === "health")?.value ?? {};
  const staleDays = rules.staleDays ?? 7;
  const overdueDays = rules.overdueDays ?? 1;
  const approvalDays = rules.approvalDays ?? 2;
  const historyDays = rules.historyDays ?? 90;
  const anomalyBps = rules.anomalyBps ?? 1000;
  const averageDiscount = (quote: Workspace["quotes"][number]) =>
    quote.lines.length
      ? quote.lines.reduce(
          (sum, line) =>
            sum + (10000 - ((10000 - line.discountBps) * (10000 - quote.orderDiscountBps)) / 10000),
          0,
        ) / quote.lines.length
      : 0;
  const items: {
    action: string;
    customer: string;
    detail: string;
    href: string;
    id: string;
    level: "HIGH" | "MEDIUM";
    quoteId?: string;
    title: string;
  }[] = [];
  const customerName = (id: string) =>
    data.customers.find((customer) => customer.id === id)?.name ?? "Customer";
  for (const quote of data.quotes) {
    const days = actualDays(new Date(quote.updatedAt), now);
    if (quote.status === "PENDING_APPROVAL" && days >= approvalDays)
      items.push({
        action: "Review approval",
        customer: customerName(quote.customerId),
        detail: `${days} days since quote update; approval is holding up confirmation.`,
        href: `/quotations/${quote.id}`,
        quoteId: quote.id,
        id: `approval:${quote.id}`,
        level: "HIGH",
        title: `${quote.number}: approval waiting`,
      });
    else if (["DRAFT", "SENT", "UNDER_NEGOTIATION"].includes(quote.status) && days >= staleDays)
      items.push({
        action: "Open pipeline",
        customer: customerName(quote.customerId),
        detail: `${days} days without a commercial update. Follow up with the customer.`,
        href: `/quotations/${quote.id}`,
        quoteId: quote.id,
        id: `stale:${quote.id}`,
        level: "MEDIUM",
        title: `${quote.number}: deal needs attention`,
      });
    const history = data.quotes.filter(
      (past) =>
        past.id !== quote.id &&
        past.ownerId === quote.ownerId &&
        past.status === "CONFIRMED" &&
        actualDays(new Date(past.updatedAt), now) >= 0 &&
        actualDays(new Date(past.updatedAt), now) <= historyDays,
    );
    if (history.length >= 3 && !["CONFIRMED", "REJECTED"].includes(quote.status)) {
      const historical =
        history.reduce((sum, past) => sum + averageDiscount(past), 0) / history.length;
      const current = averageDiscount(quote);
      if (current > historical + anomalyBps)
        items.push({
          action: "Review discount",
          customer: customerName(quote.customerId),
          detail: `Current average discount ${(current / 100).toFixed(1)}% exceeds this representative's ${(historical / 100).toFixed(1)}% average across ${history.length} confirmed quotes in ${historyDays} days.`,
          href: `/quotations/${quote.id}`,
          id: `anomaly:${quote.id}`,
          level: "HIGH",
          quoteId: quote.id,
          title: `${quote.number}: unusual discount`,
        });
    }
    if (quote.risk === "HIGH" && !["CONFIRMED", "REJECTED"].includes(quote.status))
      items.push({
        action: "Review quote",
        customer: customerName(quote.customerId),
        detail: "Discount exceeds the approval policy. Review line-level pricing before sending.",
        href: `/quotations/${quote.id}`,
        quoteId: quote.id,
        id: `risk:${quote.id}`,
        level: "HIGH",
        title: `${quote.number}: discount risk`,
      });
  }
  for (const invoice of data.invoices) {
    const days = actualDays(new Date(invoice.dueDate), now);
    if (invoiceOutstanding(invoice) > 0 && days >= overdueDays)
      items.push({
        action: "Review invoice",
        customer: customerName(invoice.customerId),
        detail: `${days} days overdue. Reconcile payment with finance; this does not indicate shipment delay.`,
        href: `/invoices/${invoice.id}`,
        id: `invoice:${invoice.id}`,
        level: "HIGH",
        title: `${invoice.number}: payment overdue`,
      });
  }
  for (const order of data.orders)
    if (
      order.promisedDate &&
      order.promisedDate < now.toISOString().slice(0, 10) &&
      order.fulfillmentStatus !== "FULFILLED"
    )
      items.push({
        action: "Review fulfillment",
        customer: customerName(order.customerId),
        detail:
          "Promised delivery date passed with units still unshipped. Review reservations and backorders.",
        href: `/fulfillment/${encodeURIComponent(order.id)}`,
        id: `order:${order.id}`,
        level: "HIGH",
        title: `${order.number}: delivery at risk`,
      });
  return {
    items: items.sort((a, b) => a.level.localeCompare(b.level) || a.id.localeCompare(b.id)),
    rules: { anomalyBps, approvalDays, historyDays, overdueDays, staleDays },
  };
}
