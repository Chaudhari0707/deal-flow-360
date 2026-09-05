import { describe, expect, test } from "bun:test";

import { api } from "@/server/api";

type Operation = {
  responses?: Record<string, { content?: Record<string, unknown> }>;
  security?: Record<string, string[]>[];
  tags?: string[];
};

type OpenApiDocument = {
  components?: {
    schemas?: Record<string, unknown>;
    securitySchemes?: Record<string, unknown>;
  };
  paths?: Record<string, Record<string, Operation>>;
};

async function contract() {
  const response = await api.handle(new Request("http://localhost/api/v1/openapi/json"));
  expect(response.status).toBe(200);
  return (await response.json()) as OpenApiDocument;
}

describe("generated API contract", () => {
  test("every operation declares tags and responses", async () => {
    const document = await contract();
    const operations = Object.values(document.paths ?? {}).flatMap((path) =>
      Object.entries(path)
        .filter(([method]) => ["delete", "get", "head", "patch", "post", "put"].includes(method))
        .map(([, operation]) => operation),
    );

    expect(operations.length).toBeGreaterThan(40);
    for (const operation of operations) {
      expect(operation.tags?.length).toBeGreaterThan(0);
      expect(Object.keys(operation.responses ?? {}).length).toBeGreaterThan(0);
    }
  });

  test("publishes reusable schemas and cookie security requirements", async () => {
    const document = await contract();

    expect(document.components?.schemas).toHaveProperty("ApiError");
    expect(document.components?.schemas).toHaveProperty("Quote");
    expect(document.components?.schemas).toHaveProperty("WorkspaceResponse");
    expect(document.components?.securitySchemes).toHaveProperty("SessionCookie");
    expect(document.components?.securitySchemes).toHaveProperty("PortalCookie");
    expect(document.paths?.["/api/v1/workspace"]?.get.security).toEqual([{ SessionCookie: [] }]);
    expect(document.paths?.["/api/v1/quotes/{id}/message"]?.post.security).toEqual([
      { SessionCookie: [] },
    ]);
    expect(document.paths?.["/api/v1/portal"]?.get.security).toEqual([
      { PortalCookie: [] },
      { SessionCookie: [] },
    ]);
    expect(document.paths?.["/api/v1/health"]?.get.security).toBeUndefined();
    expect(document.paths?.["/api/v1/portal/redeem"]?.post.security).toBeUndefined();
  });

  test("documents financial report download formats", async () => {
    const document = await contract();
    const content = document.paths?.["/api/v1/reports/financial"]?.get.responses?.["200"]?.content;

    expect(content).toHaveProperty("application/json");
    expect(content).toHaveProperty("application/pdf");
    expect(
      content?.["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ).toBeDefined();
    expect(
      document.paths?.["/api/v1/invoices/{id}/pdf"]?.get.responses?.["200"]?.content,
    ).toHaveProperty("application/pdf");
  });
});
