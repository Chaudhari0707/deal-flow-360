import type { BillingCadence } from "@/features/billing/_types/billing";

const dayMilliseconds = 86_400_000;
const cadenceMonths: Record<BillingCadence, number> = { monthly: 1, quarterly: 3, yearly: 12 };

export function calendarDate(value: Date): Date {
  if (!Number.isFinite(value.getTime())) throw new Error("Invalid billing date");
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

/** Period boundaries are UTC calendar dates, with an exclusive end. */
export function nextPeriodEnd(
  start: Date,
  cadence: BillingCadence,
  anchorDay = start.getUTCDate(),
): Date {
  if (!Number.isInteger(anchorDay) || anchorDay < 1 || anchorDay > 31) {
    throw new Error("Billing anchor must be a day from 1 to 31");
  }
  const date = calendarDate(start);
  const month = date.getUTCMonth() + cadenceMonths[cadence];
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(date.getUTCFullYear(), month, Math.min(anchorDay, lastDay)));
}

export function actualDays(start: Date, end: Date): number {
  return (calendarDate(end).getTime() - calendarDate(start).getTime()) / dayMilliseconds;
}

export function roundRatioHalfUp(amount: number, numerator: number, denominator: number): number {
  if (
    ![amount, numerator, denominator].every(Number.isSafeInteger) ||
    numerator < 0 ||
    denominator <= 0
  ) {
    throw new Error("Money and day counts must be safe integers with a positive denominator");
  }
  const absolute = BigInt(Math.abs(amount)) * BigInt(numerator);
  const divisor = BigInt(denominator);
  const rounded = (absolute * 2n + divisor) / (divisor * 2n);
  const result = Number(rounded) * Math.sign(amount);
  if (!Number.isSafeInteger(result)) throw new Error("Money exceeds safe integer range");
  return result;
}

export function periodCharge(unitPriceCents: number, quantity: number): number {
  if (
    !Number.isSafeInteger(unitPriceCents) ||
    unitPriceCents < 0 ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1
  ) {
    throw new Error("Price must be nonnegative cents and quantity must be positive");
  }
  const result = unitPriceCents * quantity;
  if (!Number.isSafeInteger(result)) throw new Error("Period charge exceeds safe integer range");
  return result;
}

export function proratedAdjustment(
  oldChargeCents: number,
  newChargeCents: number,
  periodStart: Date,
  periodEnd: Date,
  effectiveAt: Date,
): number {
  if (
    ![oldChargeCents, newChargeCents].every((value) => Number.isSafeInteger(value) && value >= 0)
  ) {
    throw new Error("Charges must be nonnegative integer cents");
  }
  const days = actualDays(periodStart, periodEnd);
  const remaining = actualDays(effectiveAt, periodEnd);
  if (days <= 0 || remaining < 0 || remaining > days)
    throw new Error("Effective date must be within the billing period");
  return roundRatioHalfUp(newChargeCents - oldChargeCents, remaining, days);
}

export function invoiceOutstanding(invoice: {
  totalCents: number;
  paidCents: number;
  creditedCents: number;
}): number {
  return Math.max(0, invoice.totalCents - invoice.paidCents - invoice.creditedCents);
}
