"use client";

import useSWR from "swr";

import { eyebrowType } from "@/components/editorial/editorial";
import { Button } from "@/components/ui/button";
import type { LineInput } from "@/features/quotes/_types/quotes";
import { calculateQuote, defaultDiscounts, money, priceLines } from "@/features/quotes/rules";
import { apiClient, apiData } from "@/lib/api/client";
import type { Workspace } from "@/lib/domain/_types/workspace";
import { cn } from "@/lib/utils";

/** Quiet label type: hierarchy from size, weight, case and letter-spacing, never from opacity. */

export function PurchaseRecommendations({
  customerId,
  products,
  existingIds,
  disabled,
  limits,
  orderDiscountBps,
  onAdd,
  pricelists,
  tier,
}: {
  customerId: string;
  products: Workspace["products"];
  existingIds: string[];
  disabled: boolean;
  limits?: Record<string, number>;
  orderDiscountBps: number;
  onAdd: (id: string) => void;
  pricelists?: Record<string, number>;
  tier: string;
}) {
  const selectedProductIds = [...new Set(existingIds)].sort();
  const { data, error, isLoading, mutate } = useSWR(
    customerId ? ["/api/v1/quotes/recommendations", customerId, selectedProductIds] : null,
    async () =>
      apiData(
        await apiClient.api.v1.quotes.recommendations.get({
          query: { customerId, selectedProductIds },
        }),
      ),
    { keepPreviousData: false },
  );
  const validDiscount =
    Number.isInteger(orderDiscountBps) && orderDiscountBps >= 0 && orderDiscountBps <= 10000;
  const suggestions = (validDiscount ? (data?.productIds ?? []) : []).flatMap((id) => {
    const product = products.find((item) => item.id === id && item.active);
    if (!product || existingIds.includes(id)) return [];
    const input: LineInput = {
      productId: id,
      quantity: 1,
      discountBps: product.promoted ? product.promotionBps : 0,
    };
    const policy = limits ?? defaultDiscounts;
    const [line] = calculateQuote(
      priceLines(products, tier, [input], pricelists),
      orderDiscountBps,
      tier,
      policy,
    ).lines;
    if (!line) return [];
    return [
      {
        marginCents: line.netCents - line.costCents * line.quantity,
        product,
      },
    ];
  });
  return (
    <section>
      <div className="border-b border-border-strong pb-3">
        <p className={cn(eyebrowType, "text-foreground")}>Recommended products</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {data?.source === "last_purchase"
            ? "From this customer’s last purchase."
            : data
              ? "Best sellers — this customer has no purchases yet."
              : "Suggestions for the selected customer."}
        </p>
      </div>
      <div aria-live="polite">
        {!customerId ? (
          <p className="py-4 text-sm text-foreground">Select a customer to see recommendations.</p>
        ) : isLoading ? (
          <p role="status" className="py-4 text-sm text-muted-foreground">
            Loading recommendations…
          </p>
        ) : error ? (
          <div role="alert" className="my-4 border-l-2 border-ink-risk pl-5">
            <p className="text-sm text-foreground">Couldn’t load recommendations.</p>
            <Button type="button" variant="outline" className="mt-3" onClick={() => void mutate()}>
              Retry recommendations
            </Button>
          </div>
        ) : !validDiscount ? (
          <p className="py-4 text-sm text-muted-foreground">
            Enter an order discount between 0% and 100% to see recommendations.
          </p>
        ) : suggestions.length ? (
          suggestions.map((product) => (
            <div
              key={product.product.id}
              className="flex items-baseline justify-between gap-4 border-b border-border py-3.5 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="text-sm text-foreground">{product.product.name}</p>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {product.product.promoted && product.product.promotionBps > 0
                    ? `Promotion discount ${(product.product.promotionBps / 100).toFixed(2)}%`
                    : `Estimated margin ${money(product.marginCents)}`}
                </p>
              </div>
              <div className="shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  aria-label={`Add ${product.product.name} recommendation to quote`}
                  onClick={() => onAdd(product.product.id)}
                >
                  Add
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="py-4 text-sm text-muted-foreground">
            No additional products to recommend. You can still choose products from the catalog.
          </p>
        )}
      </div>
    </section>
  );
}
