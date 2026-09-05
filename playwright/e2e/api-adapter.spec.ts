import { expect, test } from "@playwright/test";

test("@regression Next adapts Elysia GET, HEAD and same-origin OPTIONS intentionally", async ({
  request,
}) => {
  const get = await request.get("/api/v1/health");
  expect(get.status()).toBe(200);
  expect(await get.json()).toEqual({ status: "ok" });

  const head = await request.head("/api/v1/health");
  expect(head.status()).toBe(200);
  expect(head.headers()["content-type"]).toContain("application/json");
  expect(await head.text()).toBe("");

  const options = await request.fetch("/api/v1/health", {
    method: "OPTIONS",
    headers: {
      origin: "https://untrusted.example",
      "access-control-request-method": "POST",
    },
  });
  expect(options.status()).toBe(204);
  expect(options.headers().allow).toBe("DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT");
  expect(options.headers()["access-control-allow-origin"]).toBeUndefined();
  expect(await options.text()).toBe("");
});
