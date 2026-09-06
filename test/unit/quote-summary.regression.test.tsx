import { describe, expect, test } from "bun:test";

import { renderToStaticMarkup } from "react-dom/server";

import { QuoteTotals } from "@/features/quotes/quote-summary";
import { calculateQuote, priceLines } from "@/features/quotes/rules";

const products = [
  { id: "monthly", name: "Monthly care", intervalMonths: 1, priceCents: 2800 },
  { id: "annual", name: "Annual care", intervalMonths: 12, priceCents: 40000 },
  { id: "setup", name: "Setup", intervalMonths: 0, priceCents: 10000 },
].map((product) => ({
  ...product,
  category: "Services",
  costCents: 1000,
  taxBps: 0,
  stockable: false,
  variant: "Standard",
}));

function preview(ids: string[], quantity = 1, discountBps = 200) {
  return calculateQuote(
    priceLines(
      products,
      "Gold",
      ids.map((productId, index) => ({
        id: String(index),
        productId,
        quantity,
        discountBps,
      })),
    ),
    200,
    "Gold",
  );
}

describe("quotation summary billing periods", () => {
  test("subscription-only quote shows discounted monthly and annual breakdowns", () => {
    const totals = preview(["monthly", "annual"]);
    expect(totals.totalCents).toBe(0);
    const html = renderToStaticMarkup(<QuoteTotals totals={totals} />);
    expect(html).toContain("Monthly charges");
    expect(html).toContain("Annual charges");
    for (const value of ["₹28.00", "₹1.11", "₹26.89", "₹400.00", "₹15.84", "₹384.16"])
      expect(html).toContain(value);
    expect(html).toContain("Discount savings");
    expect(html).toContain("No one-time charges");
  });

  test("same-period products sum together and mixed quote keeps one-time charges separate", () => {
    const html = renderToStaticMarkup(
      <QuoteTotals totals={preview(["monthly", "monthly", "setup"], 2)} />,
    );
    expect(html.match(/aria-label="Monthly charges"/g)).toHaveLength(1);
    expect(html).toContain("₹107.56");
    expect(html).toContain("One-time charges");
    expect(html).toContain("₹192.08");
    expect(html).toContain("₹7.92");
  });

  test("tax and margin use the calculated net; full discounts still show savings", () => {
    const totals = calculateQuote(
      priceLines([{ ...products[0]!, taxBps: 1800 }], "Gold", [
        { productId: "monthly", quantity: 1, discountBps: 1000 },
      ]),
      0,
      "Gold",
    );
    const html = renderToStaticMarkup(<QuoteTotals totals={totals} />);
    for (const value of ["₹2.80", "₹25.20", "₹4.54", "₹29.74", "₹15.20"])
      expect(html).toContain(value);
    expect(renderToStaticMarkup(<QuoteTotals totals={preview(["annual"], 1, 10000)} />)).toContain(
      "₹400.00",
    );
  });

  test("unavailable calculations do not claim zero totals or automatic approval", () => {
    const html = renderToStaticMarkup(<QuoteTotals />);
    expect(html).not.toContain("₹0.00");
    expect(html).not.toContain("automatic approval");
    expect(html).toContain("Add valid quotation lines");
  });
});
