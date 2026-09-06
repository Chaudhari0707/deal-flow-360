import { describe, expect, test } from "bun:test";

import {
  actualDays,
  invoiceOutstanding,
  nextPeriodEnd,
  periodCharge,
  proratedAdjustment,
  roundRatioHalfUp,
} from "@/features/billing/rules";

const date = (value: string) => new Date(`${value}T00:00:00Z`);

describe("billing calendars and integer money", () => {
  test("clamps month ends without losing the January 31 anchor", () => {
    const february = nextPeriodEnd(date("2025-01-31"), "monthly");
    expect(february.toISOString()).toBe("2025-02-28T00:00:00.000Z");
    expect(nextPeriodEnd(february, "monthly", 31).toISOString()).toBe("2025-03-31T00:00:00.000Z");
  });
  test("supports leap years, quarter and annual cycles", () => {
    expect(nextPeriodEnd(date("2024-01-31"), "monthly")).toEqual(date("2024-02-29"));
    expect(nextPeriodEnd(date("2024-02-29"), "yearly")).toEqual(date("2025-02-28"));
    expect(nextPeriodEnd(date("2025-11-30"), "quarterly")).toEqual(date("2026-02-28"));
  });
  test("counts calendar days across daylight savings and ignores time of day", () => {
    expect(actualDays(new Date("2026-03-01T23:59:00Z"), new Date("2026-04-01T01:00:00Z"))).toBe(31);
  });
  test("prorates the documented 30-day ₹46 charge to 15 unused days", () => {
    expect(
      proratedAdjustment(4600, 0, date("2026-04-01"), date("2026-05-01"), date("2026-04-16")),
    ).toBe(-2300);
    expect(
      proratedAdjustment(4600, 9200, date("2026-04-01"), date("2026-05-01"), date("2026-04-16")),
    ).toBe(2300);
  });
  test("uses actual month length and half-up cents for both signs", () => {
    expect(
      proratedAdjustment(0, 4600, date("2026-01-01"), date("2026-02-01"), date("2026-01-17")),
    ).toBe(2226);
    expect(roundRatioHalfUp(1, 1, 2)).toBe(1);
    expect(roundRatioHalfUp(-1, 1, 2)).toBe(-1);
    expect(roundRatioHalfUp(10, 1, 3)).toBe(3);
  });
  test("full start adjustment and zero end adjustment", () => {
    expect(
      proratedAdjustment(1000, 2000, date("2026-01-01"), date("2026-02-01"), date("2026-01-01")),
    ).toBe(1000);
    expect(
      proratedAdjustment(1000, 2000, date("2026-01-01"), date("2026-02-01"), date("2026-02-01")),
    ).toBe(0);
  });
  test("rejects reversed, out-of-period, unsafe or fractional money", () => {
    expect(() =>
      proratedAdjustment(1, 2, date("2026-02-01"), date("2026-01-01"), date("2026-01-01")),
    ).toThrow();
    expect(() =>
      proratedAdjustment(1, 2, date("2026-01-01"), date("2026-02-01"), date("2025-12-31")),
    ).toThrow();
    expect(() => periodCharge(1.5, 2)).toThrow();
    expect(() => periodCharge(100, 0)).toThrow();
    expect(() => roundRatioHalfUp(Number.MAX_SAFE_INTEGER, 2, 1)).toThrow();
    expect(() => nextPeriodEnd(date("2026-01-01"), "monthly", 32)).toThrow();
  });
  test("outstanding deducts credits and payments without a negative balance", () => {
    expect(invoiceOutstanding({ totalCents: 1000, paidCents: 200, creditedCents: 300 })).toBe(500);
    expect(invoiceOutstanding({ totalCents: 1000, paidCents: 1000, creditedCents: 300 })).toBe(0);
  });
});
