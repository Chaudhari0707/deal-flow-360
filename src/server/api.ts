import { openapi } from "@elysiajs/openapi";
import { Elysia } from "elysia";

export const api = new Elysia({ prefix: "/api/v1" })
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
  .get("/health", () => ({ status: "ok" as const }));
