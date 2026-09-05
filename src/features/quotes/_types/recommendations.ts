export type PurchaseRecommendations = {
  productIds: string[];
  source: "last_purchase" | "best_sellers";
};
