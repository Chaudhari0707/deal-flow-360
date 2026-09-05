import { Elysia } from "elysia";

import { deleteCatalogCustomer } from "@/features/catalog/customer-lifecycle";
import {
  catalogIdParamsModel,
  catalogModels,
  customerBodyModel,
  productBodyModel,
  settingBodyModel,
} from "@/features/catalog/model";
import {
  saveCatalogCustomer,
  saveCatalogProduct,
  saveCatalogSetting,
} from "@/features/catalog/service";
import { actorContext } from "@/server/access";
import { apiErrorResponses, customerModel, productModel, settingModel } from "@/server/models";

export const catalogRoutes = new Elysia({ name: "catalog", tags: ["Catalog"] })
  .model(catalogModels)
  .use(actorContext)
  .post("/catalog/products", async ({ actor, body }) => saveCatalogProduct(body, actor), {
    authorize: ["admin"],
    body: productBodyModel,
    response: { 200: productModel, ...apiErrorResponses },
  })
  .patch(
    "/catalog/products/:id",
    async ({ actor, body, params }) => saveCatalogProduct(body, actor, params.id),
    {
      authorize: ["admin"],
      params: catalogIdParamsModel,
      body: productBodyModel,
      response: { 200: productModel, ...apiErrorResponses },
    },
  )
  .post("/customers", async ({ actor, body }) => saveCatalogCustomer(body, actor), {
    authorize: ["rep", "manager", "admin"],
    body: customerBodyModel,
    response: { 200: customerModel, ...apiErrorResponses },
  })
  .patch(
    "/customers/:id",
    async ({ actor, body, params }) => saveCatalogCustomer(body, actor, params.id),
    {
      authorize: ["manager", "admin"],
      params: catalogIdParamsModel,
      body: customerBodyModel,
      response: { 200: customerModel, ...apiErrorResponses },
    },
  )
  .patch(
    "/settings/:id",
    async ({ actor, body, params }) => saveCatalogSetting(params.id, body, actor),
    {
      authorize: ["manager", "admin"],
      params: catalogIdParamsModel,
      body: settingBodyModel,
      response: { 200: settingModel, ...apiErrorResponses },
    },
  )
  .delete("/customers/:id", async ({ actor, params }) => deleteCatalogCustomer(params.id, actor), {
    authorize: ["manager", "admin"],
    params: catalogIdParamsModel,
    response: { 200: customerModel, ...apiErrorResponses },
  });
