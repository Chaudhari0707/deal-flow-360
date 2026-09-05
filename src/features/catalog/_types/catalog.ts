import type { Static } from "elysia";

import type {
  customerBodyModel,
  productBodyModel,
  settingBodyModel,
} from "@/features/catalog/model";

export type CatalogCustomerInput = Static<typeof customerBodyModel>;
export type CatalogProductInput = Static<typeof productBodyModel>;
export type CatalogSettingInput = Static<typeof settingBodyModel>;
