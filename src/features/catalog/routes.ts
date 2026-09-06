import { Elysia } from "elysia";

import { deleteCatalogCustomer } from "@/features/catalog/customer-lifecycle";
import {
  createCustomerWithLogin,
  customerInvitation,
  sendCustomerInvitation,
} from "@/features/catalog/customer-onboarding";
import {
  catalogIdParamsModel,
  catalogModels,
  customerBodyModel,
  customerCreatedModel,
  customerInvitationModel,
  productBodyModel,
  settingBodyModel,
} from "@/features/catalog/model";
import {
  saveCatalogCustomer,
  saveCatalogProduct,
  saveCatalogSetting,
} from "@/features/catalog/service";
import { permissions } from "@/lib/domain/permissions";
import { actorContext } from "@/server/access";
import { apiErrorResponses, customerModel, productModel, settingModel } from "@/server/models";

export const catalogRoutes = new Elysia({ name: "catalog", tags: ["Catalog"] })
  .model(catalogModels)
  .use(actorContext)
  .post("/catalog/products", async ({ actor, body }) => saveCatalogProduct(body, actor), {
    authorize: permissions.catalog,
    body: productBodyModel,
    response: { 200: productModel, ...apiErrorResponses },
  })
  .patch(
    "/catalog/products/:id",
    async ({ actor, body, params }) => saveCatalogProduct(body, actor, params.id),
    {
      authorize: permissions.catalog,
      params: catalogIdParamsModel,
      body: productBodyModel,
      response: { 200: productModel, ...apiErrorResponses },
    },
  )
  .post("/customers", async ({ actor, body }) => createCustomerWithLogin(body, actor), {
    authorize: permissions.customerCreate,
    body: customerBodyModel,
    response: { 200: customerCreatedModel, ...apiErrorResponses },
  })
  .get(
    "/customers/:id/invitation",
    async ({ actor, params }) => customerInvitation(params.id, actor),
    {
      authorize: permissions.customers,
      params: catalogIdParamsModel,
      response: { 200: customerInvitationModel, ...apiErrorResponses },
    },
  )
  .post(
    "/customers/:id/invitation/retry",
    async ({ actor, params }) => sendCustomerInvitation(params.id, actor),
    {
      authorize: permissions.customers,
      params: catalogIdParamsModel,
      response: { 200: customerInvitationModel, ...apiErrorResponses },
    },
  )
  .patch(
    "/customers/:id",
    async ({ actor, body, params }) => saveCatalogCustomer(body, actor, params.id),
    {
      authorize: permissions.customerEdit,
      params: catalogIdParamsModel,
      body: customerBodyModel,
      response: { 200: customerModel, ...apiErrorResponses },
    },
  )
  .patch(
    "/settings/:id",
    async ({ actor, body, params }) => saveCatalogSetting(params.id, body, actor),
    {
      authorize: permissions.settings,
      params: catalogIdParamsModel,
      body: settingBodyModel,
      response: { 200: settingModel, ...apiErrorResponses },
    },
  )
  .delete("/customers/:id", async ({ actor, params }) => deleteCatalogCustomer(params.id, actor), {
    authorize: permissions.customerEdit,
    params: catalogIdParamsModel,
    response: { 200: customerModel, ...apiErrorResponses },
  });
