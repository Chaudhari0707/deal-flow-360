import { afterAll, expect, test } from "bun:test";

import { assertQuoteAction } from "@/features/quotes/client-action";
import { apiClient, apiData } from "@/lib/api/client";

const originalFetch = globalThis.fetch;
afterAll(() => {
  globalThis.fetch = originalFetch;
});
const quote = {
  customerId: "customer-a",
  lines: [{ productId: "product-a", quantity: 1, discountBps: 0 }],
  orderDiscountBps: 0,
};

function mockResponse(response: Response, capture?: (input: RequestInfo | URL) => void) {
  globalThis.fetch = Object.assign(
    async (input: RequestInfo | URL) => {
      capture?.(input);
      return response;
    },
    { preconnect: originalFetch.preconnect },
  );
}

test("Eden quote actions preserve useful errors for HTML, empty and null responses", async () => {
  for (const response of [
    new Response("upstream unavailable", { status: 502, statusText: "Bad Gateway" }),
    new Response(null, { status: 500 }),
    Response.json(null, { status: 400 }),
    new Response(null, { status: 204 }),
  ]) {
    mockResponse(response);
    const result = await apiClient.api.v1.quotes.post(quote);
    expect(() => apiData(result, "The action failed. Refresh and try again.")).toThrow(
      "The action failed. Refresh and try again.",
    );
  }
  mockResponse(Response.json({ error: "Terms changed" }, { status: 409 }));
  const conflict = await apiClient.api.v1.quotes.post(quote);
  expect(() => apiData(conflict, "The action failed. Refresh and try again.")).toThrow(
    "Terms changed",
  );

  mockResponse(Response.json({ error: { message: "Refresh the invoice first" } }, { status: 409 }));
  const nested = await apiClient.api.v1.quotes.post(quote);
  expect(() => apiData(nested)).toThrow("Refresh the invoice first");
});

test("Eden uses relative same-origin URLs and encodes typed query values", async () => {
  let requested = "";
  mockResponse(
    Response.json({ productIds: [], source: "last_purchase" }),
    (input) => (requested = String(input)),
  );
  const result = await apiClient.api.v1.quotes.recommendations.get({
    query: { customerId: "customer/a & b" },
  });

  expect(apiData(result)).toEqual({ productIds: [], source: "last_purchase" });
  expect(requested).toBe("/api/v1/quotes/recommendations?customerId=customer%2Fa%20%26%20b");
});

test("HTTP 200 with FAILED status is treated as a failed board action", () => {
  expect(() =>
    assertQuoteAction({
      message:
        "Email provider rejected the send. Check the configured sender and recipient, then retry.",
      status: "FAILED",
    }),
  ).toThrow("Email provider rejected the send");
  expect(assertQuoteAction({ status: "SENT" })).toEqual({ status: "SENT" });
});
