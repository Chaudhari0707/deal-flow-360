import type { LineInput, PricingProduct } from "@/features/quotes/_types/quotes";
import type { QuoteLine, RiskSnapshot } from "@/lib/domain/_types/domain";

export const defaultDiscounts: Record<string, number> = {
  Bronze: 500,
  Silver: 1000,
  Gold: 1500,
  Hardware: 1500,
  Services: 1000,
  Subscription: 1500,
  highLineBps: 500,
  highTotalBps: 800,
};

export const defaultPricelists: Record<string, number> = {
  Bronze: 10000,
  Silver: 9500,
  Gold: 9000,
};

function rounded(n: bigint, d: bigint) {
  return Number((n + d / 2n) / d);
}

export function priceLines(
  products: PricingProduct[],
  tier: string,
  inputs: LineInput[],
  pricelists = defaultPricelists,
) {
  return inputs.map((input) => {
    const product = products.find((p) => p.id === input.productId);
    if (!product) throw new Error("Product is not available");
    const factor = product.category === "Hardware" ? (pricelists[tier] ?? 10000) : 10000;
    return {
      category: product.category,
      costCents: product.costCents,
      discountBps: input.discountBps,
      id: input.id ?? product.id,
      intervalMonths: product.intervalMonths,
      name: product.name,
      netCents: 0,
      priceCents: rounded(BigInt(product.priceCents) * BigInt(factor), 10000n),
      productId: product.id,
      quantity: input.quantity,
      stockable: product.stockable,
      taxBps: product.taxBps,
      taxCents: 0,
      totalCents: 0,
      upsell:
        input.upsell === true &&
        inputs.some(
          (other) =>
            other.productId !== input.productId &&
            products
              .find((candidate) => candidate.id === other.productId)
              ?.pairedProductIds?.includes(input.productId),
        ),
      variant: product.variant,
    };
  });
}

export function calculateQuote(
  lines: QuoteLine[],
  orderDiscountBps: number,
  tier: string,
  limits = defaultDiscounts,
) {
  if (!lines.length || lines.length > 100) throw new Error("Add between 1 and 100 quotation lines");
  if (new Set(lines.map((line) => line.id)).size !== lines.length)
    throw new Error("Each quotation line needs a unique identity");
  if (!Number.isInteger(orderDiscountBps) || orderDiscountBps < 0 || orderDiscountBps > 10000)
    throw new Error("Order discount must be between 0% and 100%");
  const priced = lines.map((line) => {
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 10000)
      throw new Error("Quantity must be an integer from 1 to 10,000");
    for (const v of [line.priceCents, line.costCents, line.taxBps, line.discountBps])
      if (!Number.isSafeInteger(v) || v < 0) throw new Error("Invalid line amounts");
    if (line.discountBps > 10000 || line.taxBps > 10000)
      throw new Error("Percentages must be between 0% and 100%");
    const netCents = rounded(
      BigInt(line.priceCents) *
        BigInt(line.quantity) *
        BigInt(10000 - line.discountBps) *
        BigInt(10000 - orderDiscountBps),
      100000000n,
    );
    const taxCents = rounded(BigInt(netCents) * BigInt(line.taxBps), 10000n);
    return { ...line, netCents, taxCents, totalCents: netCents + taxCents };
  });
  const normalized = new Map<string, QuoteLine>();
  for (const l of priced)
    normalized.set(`${l.productId}:${l.priceCents}:${l.discountBps}:${l.intervalMonths}`, l);
  const riskLines = [...normalized.values()].map((l) => {
    const ceilingBps = Math.min(limits[tier] ?? 0, limits[l.category] ?? 0);
    const effectiveBps = 10000 - ((10000 - l.discountBps) * (10000 - orderDiscountBps)) / 10000;
    return {
      ceilingBps,
      effectiveBps,
      name: l.name,
      overBps: Math.max(0, effectiveBps - ceilingBps),
    };
  });
  const maxOverBps = Math.max(...riskLines.map((l) => l.overBps));
  const sumOverBps = riskLines.reduce((s, l) => s + l.overBps, 0);
  const risk: RiskSnapshot["risk"] =
    maxOverBps === 0
      ? "NONE"
      : maxOverBps >= (limits.highLineBps ?? 500) || sumOverBps >= (limits.highTotalBps ?? 800)
        ? "HIGH"
        : "MEDIUM";
  const oneTime = priced.filter((l) => l.intervalMonths === 0);
  const subtotalCents = oneTime.reduce((s, l) => s + l.netCents, 0),
    taxCents = oneTime.reduce((s, l) => s + l.taxCents, 0);
  const recurringCents = priced
    .filter((l) => l.intervalMonths > 0)
    .reduce((s, l) => s + l.totalCents, 0);
  const marginCents = oneTime.reduce((s, l) => s + l.netCents - l.costCents * l.quantity, 0);
  if (!Number.isSafeInteger(marginCents) || Math.abs(marginCents) > 2_000_000_000)
    throw new Error("Quotation exceeds supported cost amount");
  if (subtotalCents + taxCents > 2_000_000_000 || recurringCents > 2_000_000_000)
    throw new Error("Quotation exceeds supported amount; split it into smaller quotes");
  return {
    lines: priced,
    marginCents,
    recurringCents,
    risk,
    riskSnapshot: { lines: riskLines, maxOverBps, risk, sumOverBps },
    subtotalCents,
    taxCents,
    totalCents: subtotalCents + taxCents,
  };
}

export function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
