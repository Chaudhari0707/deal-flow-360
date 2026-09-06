import { calculateQuote, priceLines } from "@/features/quotes/rules";
import type { Workspace } from "@/lib/domain/_types/workspace";

type Product = Workspace["products"][number];

type UpsellRecommendation = {
  marginCents: number;
  netCents: number;
  product: Product;
};

type RecommendationOptions = {
  limits: Record<string, number>;
  orderDiscountBps: number;
  pricelists?: Record<string, number>;
  products: Product[];
  selectedProductIds: string[];
  tier: string;
};

function compareCommercialPriority(a: UpsellRecommendation, b: UpsellRecommendation) {
  return (
    b.netCents - a.netCents ||
    b.marginCents - a.marginCents ||
    b.product.promotionBps - a.product.promotionBps ||
    a.product.id.localeCompare(b.product.id)
  );
}

function pricedRecommendation(
  product: Product,
  products: Product[],
  tier: string,
  orderDiscountBps: number,
  limits: Record<string, number>,
  pricelists?: Record<string, number>,
): UpsellRecommendation {
  const [line] = calculateQuote(
    priceLines(
      products,
      tier,
      [
        {
          discountBps: product.promoted ? product.promotionBps : 0,
          productId: product.id,
          quantity: 1,
        },
      ],
      pricelists,
    ),
    orderDiscountBps,
    tier,
    limits,
  ).lines;
  return {
    marginCents: line!.netCents - line!.costCents * line!.quantity,
    netCents: line!.netCents,
    product,
  };
}

/**
 * Use one configured upsell from each selected product before taking a second from any source.
 * Within each pass, higher expected sale value, margin, and promotion take priority; this makes
 * the five-slot cap deterministic while keeping multi-product quotes represented fairly.
 */
export function recommendUpsells({
  limits,
  orderDiscountBps,
  pricelists,
  products,
  selectedProductIds,
  tier,
}: RecommendationOptions): UpsellRecommendation[] {
  if (!Number.isInteger(orderDiscountBps) || orderDiscountBps < 0 || orderDiscountBps > 10_000)
    return [];
  const selectedIds = [...new Set(selectedProductIds)];
  const selected = new Set(selectedIds);
  const productsById = new Map(products.map((product) => [product.id, product]));
  const candidatesBySource = selectedIds.map((sourceId) => {
    const source = productsById.get(sourceId);
    if (!source) return [];
    return [...new Set(source.pairedProductIds)]
      .filter((id) => !selected.has(id))
      .flatMap((id) => {
        const product = productsById.get(id);
        return product?.active
          ? [pricedRecommendation(product, products, tier, orderDiscountBps, limits, pricelists)]
          : [];
      })
      .sort(compareCommercialPriority);
  });
  const recommendations: UpsellRecommendation[] = [];
  const recommendedIds = new Set<string>();
  while (recommendations.length < 5) {
    const inThisPass = new Set<string>();
    const pass = candidatesBySource.flatMap((candidates) => {
      const candidate = candidates.find(
        (entry) => !recommendedIds.has(entry.product.id) && !inThisPass.has(entry.product.id),
      );
      if (candidate) inThisPass.add(candidate.product.id);
      return candidate ? [candidate] : [];
    });
    if (!pass.length) break;
    for (const candidate of pass.sort(compareCommercialPriority)) {
      if (recommendations.length === 5) break;
      recommendations.push(candidate);
      recommendedIds.add(candidate.product.id);
    }
  }
  return recommendations;
}
