import { openapi } from "@elysiajs/openapi";
import { Elysia } from "elysia";

import { healthRoutes } from "@/features/billing/health-routes";
import { billingRoutes } from "@/features/billing/routes";
import { inventoryRoutes } from "@/features/inventory/routes";
import { portalRoutes } from "@/features/quotes/portal-routes";
import { quoteRoutes } from "@/features/quotes/routes";
import { catalogRoutes } from "@/server/catalog";
import { DomainError } from "@/server/errors";
import { workspaceRoutes } from "@/server/workspace";

export const api = new Elysia({ prefix: "/api/v1", normalize: false })
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
        info: {
          title: "DealFlow360 API",
          version: "0.1.0",
        },
      },
      path: "/openapi",
    }),
  )
  .get("/health", () => ({ status: "ok" as const }))
  .use(workspaceRoutes)
  .use(catalogRoutes)
  .use(quoteRoutes)
  .use(portalRoutes)
  .use(inventoryRoutes)
  .use(billingRoutes)
  .use(healthRoutes);
