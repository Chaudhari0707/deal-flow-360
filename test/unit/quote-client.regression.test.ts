import { afterAll, expect, test } from "bun:test";

import { quoteRequest } from "@/features/quotes/client-action";

const originalFetch = globalThis.fetch;
afterAll(() => {
  globalThis.fetch = originalFetch;
});
test("quote actions report useful errors for HTML, empty and null responses", async () => {
  for (const response of [
    new Response("upstream unavailable", { status: 502 }),
    new Response(null, { status: 500 }),
    Response.json(null, { status: 400 }),
    new Response(null, { status: 204 }),
  ]) {
    globalThis.fetch = Object.assign(async () => response, {
      preconnect: originalFetch.preconnect,
    });
    await expect(quoteRequest("/quotes")).rejects.toThrow(
      "The action failed. Refresh and try again.",
    );
  }
  globalThis.fetch = Object.assign(
    async () => Response.json({ error: "Terms changed" }, { status: 409 }),
    { preconnect: originalFetch.preconnect },
  );
  await expect(quoteRequest("/quotes")).rejects.toThrow("Terms changed");
});
