import { openapi } from "@elysiajs/openapi";
import { Elysia, t } from "elysia";

import { healthRoutes } from "@/features/billing/health-routes";
import { billingModels } from "@/features/billing/model";
import { billingRoutes } from "@/features/billing/routes";
import { catalogRoutes } from "@/features/catalog/routes";
import { inventoryModels } from "@/features/inventory/model";
import { inventoryRoutes } from "@/features/inventory/routes";
import { quoteModels } from "@/features/quotes/model";
import { portalRoutes } from "@/features/quotes/portal-routes";
import { quoteRoutes } from "@/features/quotes/routes";
import { workspaceModels } from "@/features/workspace/model";
import { workspaceRoutes } from "@/features/workspace/routes";
import { DomainError } from "@/server/errors";
import { apiModels } from "@/server/models";

export const api = new Elysia({ prefix: "/api/v1", normalize: false })
  .model({ ...apiModels, ...billingModels, ...inventoryModels, ...quoteModels, ...workspaceModels })
  .onError(({ error, code, set }) => {
    if (error instanceof DomainError) {
      set.status = error.status;
      return { error: error.message };
    }
    if (code === "VALIDATION" || code === "PARSE") {
      set.status = 400;
      return { error: "Check the request fields and try again." };
    }
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "Resource not found" };
    }
    set.status = 500;
    return { error: "The operation could not be completed. Please retry." };
  })
  .use(
    openapi({
      documentation: {
        components: {
          securitySchemes: {
            SessionCookie: {
              type: "apiKey",
              in: "cookie",
              name: "better-auth.session_token",
            },
            PortalCookie: {
              type: "apiKey",
              in: "cookie",
              name: "dealflow_portal",
            },
          },
        },
        info: {
          title: "DealFlow360 API",
          version: "0.1.0",
        },
        tags: [
          { name: "System" },
          { name: "Workspace" },
          { name: "Catalog" },
          { name: "Quotes" },
          { name: "Portal" },
          { name: "Inventory" },
          { name: "Billing" },
          { name: "Health" },
        ],
      },
      path: "/openapi",
    }),
  )
  .get("/health", () => ({ status: "ok" as const }), {
    detail: { tags: ["System"] },
    response: { 200: t.Object({ status: t.Literal("ok") }) },
  })
  .use(workspaceRoutes)
  .use(catalogRoutes)
  .use(quoteRoutes)
  .use(portalRoutes)
  .use(inventoryRoutes)
  .use(billingRoutes)
  .use(healthRoutes);
