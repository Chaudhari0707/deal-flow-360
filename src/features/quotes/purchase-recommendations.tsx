import { eyebrowType } from "@/components/editorial/editorial";
import { Button } from "@/components/ui/button";
import { defaultDiscounts, money } from "@/features/quotes/rules";
import { recommendUpsells } from "@/features/quotes/upsell-recommendations";
import type { Workspace } from "@/lib/domain/_types/workspace";
import { cn } from "@/lib/utils";

export function PurchaseRecommendations({
  products,
  selectedProductIds,
  disabled,
  limits,
  orderDiscountBps,
  onAdd,
  pricelists,
  tier,
}: {
  products: Workspace["products"];
  selectedProductIds: string[];
  disabled: boolean;
  limits?: Record<string, number>;
  orderDiscountBps: number;
  onAdd: (id: string) => void;
  pricelists?: Record<string, number>;
  tier: string;
}) {
  const validDiscount =
    Number.isInteger(orderDiscountBps) && orderDiscountBps >= 0 && orderDiscountBps <= 10000;
  const suggestions = validDiscount
    ? recommendUpsells({
        limits: limits ?? defaultDiscounts,
        orderDiscountBps,
        pricelists,
        products,
        selectedProductIds,
        tier,
      })
    : [];
  return (
    <section>
      <div className="border-b border-border-strong pb-3">
        <p className={cn(eyebrowType, "text-foreground")}>Upsell recommendations</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Configured add-ons for the products currently selected on this quotation. Up to five are
          shown, rotating across products when more than one is selected.
        </p>
      </div>
      <div aria-live="polite">
        {!selectedProductIds.length ? (
          <p className="py-4 text-sm text-muted-foreground">
            Add a product to see its configured upsell recommendations.
          </p>
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
                  Estimated price {money(product.netCents)} · Margin {money(product.marginCents)}
                  {product.product.promoted && product.product.promotionBps > 0
                    ? ` · Promotion discount ${(product.product.promotionBps / 100).toFixed(2)}%`
                    : ""}
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
            No configured upsell products are available for these quotation lines.
          </p>
        )}
      </div>
    </section>
  );
}
