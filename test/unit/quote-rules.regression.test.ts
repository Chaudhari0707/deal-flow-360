import { describe, expect, test } from "bun:test";

import { calculateQuote, priceLines } from "@/features/quotes/rules";
import type { QuoteLine } from "@/lib/domain/_types/domain";

function line(id: string, discountBps: number): QuoteLine {
  return {
    category: "Services",
    costCents: 4000,
    discountBps,
    id,
    intervalMonths: 0,
    name: id,
    netCents: 0,
    priceCents: 10000,
    productId: id,
    quantity: 1,
    stockable: false,
    taxBps: 1000,
    taxCents: 0,
    totalCents: 0,
    variant: "Standard",
  };
}

describe("quote pricing and governance regressions", () => {
  test("HIGH hero matches independently calculated one-time and recurring invoice values", () => {
    const products = [
      {
        id: "laptop",
        name: "Laptop",
        category: "Hardware",
        priceCents: 120000,
        costCents: 78000,
        taxBps: 1500,
        stockable: true,
        intervalMonths: 0,
        variant: "14 inch",
      },
      {
        id: "setup",
        name: "Setup",
        category: "Services",
        priceCents: 45000,
        costCents: 32000,
        taxBps: 1000,
        stockable: false,
        intervalMonths: 0,
        variant: "Standard",
      },
      {
        id: "warranty",
        name: "Warranty",
        category: "Services",
        priceCents: 18000,
        costCents: 4000,
        taxBps: 1000,
        stockable: false,
        intervalMonths: 0,
        variant: "Standard",
      },
      {
        id: "care",
        name: "Care",
        category: "Subscription",
        priceCents: 4600,
        costCents: 1000,
        taxBps: 0,
        stockable: false,
        intervalMonths: 1,
        variant: "Monthly",
      },
    ];
    const lines = priceLines(products, "Gold", [
      { productId: "laptop", quantity: 24, discountBps: 1200 },
      { productId: "setup", quantity: 1, discountBps: 1800 },
      { productId: "warranty", quantity: 1, discountBps: 1000 },
      { productId: "care", quantity: 1, discountBps: 0 },
    ]);
    const initial = calculateQuote(lines, 0, "Gold");
    expect(initial.totalCents).toBe(2681514);
    expect(initial.marginCents).toBe(426060);
    expect(initial.recurringCents).toBe(4600);
    expect(initial.risk).toBe("HIGH");
    const revised = calculateQuote(
      lines.map((l) => (l.id === "warranty" ? { ...l, discountBps: 1500 } : l)),
      0,
      "Gold",
    );
    expect(revised.totalCents).toBe(2680524);
    expect(revised.taxCents).toBe(347364);
    expect(revised.marginCents).toBe(425160);
  });
  test("exact single-line and blended threshold boundaries", () => {
    expect(calculateQuote([line("a", 1000)], 0, "Gold").risk).toBe("NONE");
    expect(calculateQuote([line("a", 1499)], 0, "Gold").risk).toBe("MEDIUM");
    expect(calculateQuote([line("a", 1500)], 0, "Gold").risk).toBe("HIGH");
    expect(
      calculateQuote([line("a", 1200), line("b", 1300), line("c", 1200)], 0, "Gold").risk,
    ).toBe("MEDIUM");
    expect(
      calculateQuote([line("a", 1200), line("b", 1300), line("c", 1300)], 0, "Gold").risk,
    ).toBe("HIGH");
  });
  test("order discounts cannot bypass stricter line ceiling", () => {
    const result = calculateQuote([line("a", 1000)], 1000, "Gold");
    expect(result.lines[0]!.netCents).toBe(8100);
    expect(result.riskSnapshot.lines[0]!.effectiveBps).toBe(1900);
    expect(result.risk).toBe("HIGH");
  });
  test("splitting identical commercial quantity does not alter cumulative route", () => {
    const a = line("a", 1300),
      b = { ...a, id: "b" },
      c = { ...a, id: "c" };
    expect(calculateQuote([a, b, c], 0, "Gold").risk).toBe("MEDIUM");
    expect(calculateQuote([a, b, c], 0, "Gold").riskSnapshot.sumOverBps).toBe(300);
  });
  test("duplicate row identities cannot silently omit subscription invoices", () => {
    const a = { ...line("a", 0), intervalMonths: 1 };
    expect(() => calculateQuote([a, { ...a }], 0, "Gold")).toThrow("unique identity");
  });
  test("invalid, empty and unsupported amounts fail before persistence", () => {
    expect(() => calculateQuote([], 0, "Gold")).toThrow();
    expect(() => calculateQuote([{ ...line("a", 0), quantity: 0 }], 0, "Gold")).toThrow();
    expect(() => calculateQuote([{ ...line("a", 0), quantity: 1.5 }], 0, "Gold")).toThrow();
    expect(() => calculateQuote([line("a", 10001)], 0, "Gold")).toThrow();
    expect(() => calculateQuote([line("a", 0)], -1, "Gold")).toThrow();
    expect(() =>
      calculateQuote([{ ...line("a", 10000), costCents: 10000000, quantity: 10000 }], 0, "Gold"),
    ).toThrow("cost amount");
  });
  test("tax and discounted line subtotal round half-up separately", () => {
    const result = calculateQuote(
      [{ ...line("a", 5000), priceCents: 101, taxBps: 1000 }],
      0,
      "Gold",
    );
    expect(result.lines[0]!.netCents).toBe(51);
    expect(result.lines[0]!.taxCents).toBe(5);
    expect(result.totalCents).toBe(56);
  });
});
