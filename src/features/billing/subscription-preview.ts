import { calendarDate, proratedAdjustment, roundRatioHalfUp } from "@/features/billing/rules";
import type { Workspace } from "@/lib/domain/_types/workspace";

export function subscriptionPreview(
  subscription: Workspace["subscriptions"][number] | undefined,
  product: Workspace["products"][number] | undefined,
  quantity: number,
  now = new Date(),
): { adjustment: number | null; valid: boolean } {
  const invalid = { adjustment: null, valid: false };
  if (
    !subscription ||
    !product ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > 10000
  )
    return invalid;
  if (
    product.id !== subscription.productId &&
    (!product.active ||
      product.intervalMonths !== subscription.intervalMonths ||
      product.taxBps !== subscription.taxBps)
  )
    return invalid;
  if (
    ![
      subscription.priceBasisCents,
      subscription.priceBasisQuantity,
      subscription.periodNetCents,
      subscription.taxBps,
      product.priceCents,
    ].every(Number.isSafeInteger) ||
    subscription.priceBasisCents < 0 ||
    subscription.priceBasisQuantity < 1 ||
    subscription.periodNetCents < 0 ||
    subscription.taxBps < 0 ||
    subscription.taxBps > 10000 ||
    product.priceCents < 0
  )
    return invalid;
  try {
    const start = calendarDate(new Date(subscription.periodStart)),
      end = calendarDate(new Date(subscription.periodEnd)),
      today = calendarDate(now);
    if (start > today || end <= start) return invalid;
    const net =
      product.id === subscription.productId
        ? roundRatioHalfUp(subscription.priceBasisCents, quantity, subscription.priceBasisQuantity)
        : product.priceCents * quantity;
    const oldTotal =
      subscription.periodNetCents +
      roundRatioHalfUp(subscription.periodNetCents, subscription.taxBps, 10000);
    const newTotal = net + roundRatioHalfUp(net, subscription.taxBps, 10000);
    if (newTotal > 2_147_483_647 || oldTotal > 2_147_483_647) return invalid;
    // Due periods can be reconciled by the server; only a current period has a local estimate.
    return {
      adjustment: today < end ? proratedAdjustment(oldTotal, newTotal, start, end, today) : null,
      valid: true,
    };
  } catch {
    return invalid;
  }
}
