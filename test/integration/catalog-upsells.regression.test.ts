import { beforeAll, describe, expect, test } from "bun:test";

import { eq, sql } from "drizzle-orm";

import { createAuth } from "@/lib/auth/create-auth";
import { db } from "@/lib/db/connection";
import { products, profiles } from "@/lib/db/schema";
import type { Role } from "@/lib/domain/_types/domain";
import { api } from "@/server/api";

const prefix = `catalog-upsell-${crypto.randomUUID()}`;
const upsellIds = Array.from({ length: 6 }, (_, index) => `${prefix}-candidate-${index}`);
const cookies: Partial<Record<Role, string>> = {};

function productBody(pairedProductIds: string[]) {
  return {
    active: true,
    category: "Services" as const,
    costCents: 500,
    intervalMonths: 0 as const,
    name: `${prefix}-product-${crypto.randomUUID()}`,
    pairedProductIds,
    priceCents: 1_000,
    promoted: false,
    promotionBps: 0,
    stockable: false,
    taxBps: 0,
  };
}

async function createProduct(body: ReturnType<typeof productBody>, role: Role) {
  return api.handle(
    new Request(new URL("/api/v1/catalog/products", Bun.env.BETTER_AUTH_URL), {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json", cookie: cookies[role]! },
      method: "POST",
    }),
  );
}

beforeAll(async () => {
  if (!new URL(Bun.env.DATABASE_URL!).pathname.endsWith("_test"))
    throw new Error("Requires _test database");
  await db.insert(products).values(
    upsellIds.map((id) => ({
      category: "Services",
      costCents: 100,
      id,
      name: id,
      priceCents: 1_000,
    })),
  );
  for (const role of ["admin", "rep"] as Role[]) {
    const auth = createAuth(db);
    const account = await auth.api.signUpEmail({
      body: { email: `${prefix}-${role}@example.com`, name: role, password: `Test-${role}-1!` },
    });
    await db.insert(profiles).values({ role, userId: account.user.id });
    const response = await auth.api.signInEmail({
      body: { email: `${prefix}-${role}@example.com`, password: `Test-${role}-1!` },
      asResponse: true,
    });
    cookies[role] = response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
  }
}, 30000);

describe("catalog upsell configuration", () => {
  test("persists exactly five catalog upsells and rejects a sixth at the API boundary", async () => {
    const body = productBody(upsellIds.slice(0, 5));
    const response = await createProduct(body, "admin");
    expect(response.status).toBe(200);
    const created = (await response.json()) as { id: string; pairedProductIds: string[] };
    expect(created.pairedProductIds).toEqual(upsellIds.slice(0, 5));
    const [persisted] = await db.select().from(products).where(eq(products.id, created.id));
    expect(persisted?.pairedProductIds).toEqual(upsellIds.slice(0, 5));

    const tooMany = await createProduct(productBody(upsellIds), "admin");
    expect(tooMany.status).toBe(400);

    await expect(
      db.execute(sql`
        UPDATE ${products}
        SET ${products.pairedProductIds} = ${JSON.stringify(upsellIds)}::jsonb
        WHERE ${products.id} = ${created.id}
      `),
    ).rejects.toThrow("product_upsell_limit");
    const [unchanged] = await db.select().from(products).where(eq(products.id, created.id));
    expect(unchanged?.pairedProductIds).toEqual(upsellIds.slice(0, 5));
  });

  test("rejects duplicate or missing upsells without creating a partial catalog product", async () => {
    const duplicate = await createProduct(productBody([upsellIds[0]!, upsellIds[0]!]), "admin");
    expect(duplicate.status).toBe(400);

    const missingBody = productBody([`${prefix}-missing`]);
    const missing = await createProduct(missingBody, "admin");
    expect(missing.status).toBe(400);
    const saved = await db.select().from(products).where(eq(products.name, missingBody.name));
    expect(saved).toEqual([]);
  });

  test("enforces catalog authorization for upsell configuration", async () => {
    expect((await createProduct(productBody([]), "rep")).status).toBe(403);
  });
});
