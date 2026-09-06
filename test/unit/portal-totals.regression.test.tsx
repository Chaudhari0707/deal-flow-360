import { expect, test } from "bun:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { PublicQuote } from "@/features/portal/_types/portal";
import { portalChargeGroups, PortalQuoteTotals } from "@/features/portal/portal-quote-totals";

const monthly: PublicQuote["lines"][number] = {
  id: "monthly",
  productId: "monthly",
  name: "Monthly care",
  category: "Subscription",
  quantity: 1,
  priceCents: 2800,
  discountBps: 200,
  netCents: 2689,
  taxBps: 0,
  taxCents: 0,
  totalCents: 2689,
  intervalMonths: 1,
  stockable: false,
  variant: "Monthly",
};
const annual = {
  ...monthly,
  id: "annual",
  productId: "annual",
  name: "Annual care",
  priceCents: 40000,
  netCents: 38416,
  totalCents: 38416,
  intervalMonths: 12,
};

test("portal totals expose exact saved discounts and subtotals for each subscription period", () => {
  expect(portalChargeGroups([annual, monthly])).toEqual([
    {
      title: "Monthly charges",
      intervalMonths: 1,
      beforeDiscountsCents: 2800,
      discountCents: 111,
      subtotalCents: 2689,
      taxCents: 0,
      totalCents: 2689,
    },
    {
      title: "Annual charges",
      intervalMonths: 12,
      beforeDiscountsCents: 40000,
      discountCents: 1584,
      subtotalCents: 38416,
      taxCents: 0,
      totalCents: 38416,
    },
  ]);
  const html = renderToStaticMarkup(
    <PortalQuoteTotals lines={[monthly, annual]} orderDiscountBps={200} />,
  );
  for (const text of [
    "₹1.11",
    "₹26.89",
    "₹15.84",
    "₹384.16",
    "No one-time charges",
    "2% order discount",
  ])
    expect(html).toContain(text);
  expect(html).not.toContain("Margin");
  expect(html).not.toContain("costCents");
});

test("mixed quotation sums each line's rounded net and tax without combining billing periods", () => {
  const setup = {
    ...monthly,
    id: "setup",
    intervalMonths: 0,
    priceCents: 10000,
    quantity: 2,
    netCents: 17100,
    taxBps: 1800,
    taxCents: 3078,
    totalCents: 20178,
  };
  const groups = portalChargeGroups([monthly, { ...monthly, id: "monthly2" }, setup]);
  expect(groups[0]).toMatchObject({
    beforeDiscountsCents: 20000,
    discountCents: 2900,
    subtotalCents: 17100,
    taxCents: 3078,
    totalCents: 20178,
  });
  expect(groups[1]).toMatchObject({
    beforeDiscountsCents: 5600,
    discountCents: 222,
    subtotalCents: 5378,
    totalCents: 5378,
  });
  // Saved net is authoritative even when displayed percentages don't reproduce legacy snapshots.
  expect(portalChargeGroups([{ ...monthly, discountBps: 0 }])[0]!.subtotalCents).toBe(2689);
});

test("fully discounted and nonstandard recurring plans stay visible; empty quotes have no invented totals", () => {
  const free = { ...annual, discountBps: 10000, netCents: 0, taxCents: 0, totalCents: 0 };
  const html = renderToStaticMarkup(
    <PortalQuoteTotals lines={[free, { ...monthly, intervalMonths: 6 }]} orderDiscountBps={0} />,
  );
  expect(html).toContain("Annual charges");
  expect(html).toContain("₹400.00");
  expect(html).toContain("₹0.00");
  expect(html).toContain("Charges every 6 months");
  const empty = renderToStaticMarkup(<PortalQuoteTotals lines={[]} orderDiscountBps={0} />);
  expect(empty).toContain("no line items");
  expect(empty).not.toContain("₹0.00");
});
