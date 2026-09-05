"use client";

import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LineInput } from "@/features/quotes/_types/quotes";
import { calculateQuote, defaultDiscounts, money, priceLines } from "@/features/quotes/rules";
import { apiClient, apiData } from "@/lib/api/client";
import type { Workspace } from "@/lib/domain/_types/workspace";

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
  const { data, error, isLoading, mutate } = useSWR(
    customerId
      ? `/api/v1/quotes/recommendations?customerId=${encodeURIComponent(customerId)}`
      : null,
    async () =>
      apiData(await apiClient.api.v1.quotes.recommendations.get({ query: { customerId } })),
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
        maxDiscountBps: Math.min(policy[tier] ?? 0, policy[product.category] ?? 0),
        product,
      },
    ];
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recommended products</CardTitle>
        <CardDescription>
          {data?.source === "last_purchase"
            ? "From this customer’s last purchase."
            : data
              ? "Best sellers — this customer has no purchases yet."
              : "Suggestions for the selected customer."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!customerId ? (
          <p>Select a customer to see recommendations.</p>
        ) : isLoading ? (
          <p role="status">Loading recommendations…</p>
        ) : error ? (
          <div role="alert">
            <p>Couldn’t load recommendations.</p>
            <Button type="button" variant="outline" onClick={() => void mutate()}>
              Retry recommendations
            </Button>
          </div>
        ) : !validDiscount ? (
          <p className="text-sm text-muted-foreground">
            Enter an order discount between 0% and 100% to see recommendations.
          </p>
        ) : suggestions.length ? (
          suggestions.map((product) => (
            <div key={product.product.id} className="space-y-2">
              <p className="font-medium">{product.product.name}</p>
              <p className="text-xs text-muted-foreground">
                Max discount {(product.maxDiscountBps / 100).toFixed(2)}% · Margin{" "}
                {money(product.marginCents)}
              </p>
              <div>
                <Button
                  type="button"
                  size="sm"
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
          <p className="text-sm text-muted-foreground">
            No additional products to recommend. You can still choose products from the catalog.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
