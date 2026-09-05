import type { Static } from "elysia";

import type { recommendationsModel } from "@/features/quotes/model";

export type PurchaseRecommendations = Static<typeof recommendationsModel>;
