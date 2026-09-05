import { beforeAll, describe, expect, test } from "bun:test";

import { eq } from "drizzle-orm";

import { createAuth } from "@/lib/auth/create-auth";
import { db } from "@/lib/db/connection";
import { customers, orders, products, profiles, quotes } from "@/lib/db/schema";
import type { Role } from "@/lib/domain/_types/domain";
import { api } from "@/server/api";

const prefix = `recommend-${crypto.randomUUID()}`;
const returning = `${prefix}-returning`,
  fresh = `${prefix}-new`,
  inactive = `${prefix}-inactive`;
const productIds = Array.from({ length: 8 }, (_, i) => `${prefix}-${i}`);
const cookies: Partial<Record<Role, string>> = {};

async function request(customerId: string, role?: Role, selectedProductIds?: string[]) {
  return api.handle(
    new Request(
      new URL(
        `/api/v1/quotes/recommendations?customerId=${encodeURIComponent(customerId)}${
          selectedProductIds
            ?.map((id) => `&selectedProductIds=${encodeURIComponent(id)}`)
            .join("") ?? ""
        }`,
        Bun.env.BETTER_AUTH_URL,
      ),
      {
        headers: role ? { cookie: cookies[role]! } : {},
      },
    ),
  );
}

beforeAll(async () => {
  if (!new URL(Bun.env.DATABASE_URL!).pathname.endsWith("_test"))
    throw new Error("Requires _test database");
  await db
    .insert(customers)
    .values(
      [returning, fresh, inactive].map((id) => ({ id, name: id, email: `${id}@example.com` })),
    );
  let ownerId = "";
  for (const role of ["rep", "manager", "admin", "finance", "ops", "customer"] as Role[]) {
    const email = `${prefix}-${role}@example.com`,
      password = `Test-${crypto.randomUUID()}!`;
    const auth = createAuth(db);
    const account = await auth.api.signUpEmail({ body: { email, password, name: role } });
    await db.insert(profiles).values({
      userId: account.user.id,
      role,
      customerId: role === "customer" ? returning : null,
    });
    const response = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
    cookies[role] = response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    if (role === "rep") ownerId = account.user.id;
  }
  await db.insert(products).values(
    productIds.map((id, index) => ({
      id,
      name: id,
      category: "Service",
      costCents: 100,
      priceCents: 1000,
      active: index !== 7,
    })),
  );
  for (const [suffix, customerId, ids, date] of [
    ["old", returning, [productIds[0]!], "2020-01-01"],
    ["latest-a", returning, [productIds[1]!], "2021-01-01"],
    ["latest-z", returning, [productIds[2]!, productIds[2]!, productIds[7]!], "2021-01-01"],
    ["inactive", inactive, [productIds[7]!], "2022-01-01"],
  ] as [string, string, string[], string][]) {
    const id = `${prefix}-${suffix}`;
    const lines = ids.map((productId) => ({
      id: crypto.randomUUID(),
      productId,
      quantity: 10000,
      discountBps: 0,
      priceCents: 1000,
      costCents: 100,
      taxBps: 0,
      upsell: false,
      category: "Service",
      intervalMonths: 0,
      name: productId,
      netCents: 10000000,
      stockable: false,
      taxCents: 0,
      totalCents: 10000000,
      variant: "Standard",
    }));
    await db
      .insert(quotes)
      .values({ id, number: id, customerId, ownerId, status: "CONFIRMED", lines });
    await db
      .insert(orders)
      .values({ id, quoteId: id, number: id, customerId, lines, createdAt: new Date(date) });
  }
  await db.insert(quotes).values({
    id: `${prefix}-draft`,
    number: `${prefix}-draft`,
    customerId: fresh,
    ownerId,
    status: "DRAFT",
  });
}, 30000);

describe("quotation purchase recommendations", () => {
  test("uses only latest customer order, breaks time ties, deduplicates and filters inactive products", async () => {
    const response = await request(returning, "rep");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ source: "last_purchase", productIds: [productIds[2]] });
  });

  test("no purchases falls back to total units; draft does not count and ranking ties use ID", async () => {
    const response = await request(fresh, "rep");
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.source).toBe("best_sellers");
    expect(result.productIds.slice(0, 3)).toEqual([productIds[2], productIds[0], productIds[1]]);
    expect(result.productIds).not.toContain(productIds[7]);
    expect(result.productIds.length).toBeLessThanOrEqual(5);
    expect(Object.keys(result).sort()).toEqual(["productIds", "source"]);
  });

  test("an inactive last purchase stays empty instead of switching to global sales", async () => {
    expect(await (await request(inactive, "rep")).json()).toEqual({
      source: "last_purchase",
      productIds: [],
    });
  });

  test("returns five products and refills after selection, restoring removed products", async () => {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, `${prefix}-latest-z`));
    const original = order!.lines;
    try {
      await db
        .update(orders)
        .set({ lines: productIds.map((productId) => ({ ...original[0]!, productId })) })
        .where(eq(orders.id, order!.id));
      expect(await (await request(returning, "rep")).json()).toEqual({
        source: "last_purchase",
        productIds: productIds.slice(0, 5),
      });
      expect(
        await (await request(returning, "rep", [productIds[0]!, productIds[1]!])).json(),
      ).toEqual({
        source: "last_purchase",
        productIds: productIds.slice(2, 7),
      });
      expect(await (await request(returning, "rep", productIds)).json()).toEqual({
        source: "last_purchase",
        productIds: [],
      });
      expect((await (await request(returning, "rep", [])).json()).productIds).toEqual(
        productIds.slice(0, 5),
      );
      const best = await (await request(fresh, "rep", [productIds[0]!, productIds[2]!])).json();
      expect(best.productIds).not.toContain(productIds[0]);
      expect(best.productIds).not.toContain(productIds[2]);
      expect(best.productIds).toHaveLength(5);
    } finally {
      await db.update(orders).set({ lines: original }).where(eq(orders.id, order!.id));
    }
  });

  test("requires authentication and quote creation roles", async () => {
    expect((await request(returning)).status).toBe(401);
    for (const role of ["finance", "ops", "customer", "admin", "manager"] as Role[])
      expect((await request(returning, role)).status).toBe(403);
    expect((await request(returning, "rep")).status).toBe(200);
  });

  test("validates customer selection", async () => {
    expect((await request(`${prefix}-missing`, "rep")).status).toBe(404);
    expect((await request("", "rep")).status).toBe(400);
    expect((await request(returning, "rep", [""])).status).toBe(400);
    expect(
      (
        await request(
          returning,
          "rep",
          Array.from({ length: 101 }, () => "id"),
        )
      ).status,
    ).toBe(400);
  });
});
