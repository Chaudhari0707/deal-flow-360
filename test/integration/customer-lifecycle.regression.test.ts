import { beforeAll, expect, mock, test } from "bun:test";

import { eq } from "drizzle-orm";

import { createAuth } from "@/lib/auth/create-auth";
import { db } from "@/lib/db/connection";
import { auditEntries, customers, products, profiles, user } from "@/lib/db/schema";
import type { Role } from "@/lib/domain/_types/domain";
mock.module("resend", () => ({
  Resend: class {
    emails = { send: async () => ({ data: { id: crypto.randomUUID() }, error: null }) };
  },
}));
const { api } = await import("@/server/api");

const cookies: Partial<Record<Role, string>> = {};
const auth = createAuth(db);
const productId = crypto.randomUUID();
const input = () => ({
  name: "Lifecycle customer",
  email: `customer-${crypto.randomUUID()}@example.com`,
  tier: "Gold",
  team: "Enterprise",
});
const origin = new URL(Bun.env.BETTER_AUTH_URL!).origin;
async function request(method: string, path: string, role?: Role, body?: unknown) {
  return api.handle(
    new Request(`${origin}/api/v1${path}`, {
      method,
      headers: {
        origin,
        "content-type": "application/json",
        ...(role ? { cookie: cookies[role]! } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  );
}
beforeAll(async () => {
  for (const role of ["rep", "manager", "admin", "finance", "ops", "customer"] as Role[]) {
    const email = `${role}-${crypto.randomUUID()}@example.com`;
    const password = `Test-${crypto.randomUUID()}`;
    const result = await auth.api.signUpEmail({ body: { email, password, name: role } });
    await db.insert(profiles).values({ userId: result.user.id, role });
    const login = await auth.api.signInEmail({ asResponse: true, body: { email, password } });
    cookies[role] = login.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
  }
  await db.insert(products).values({
    id: productId,
    name: "Tier hardware",
    category: "Hardware",
    priceCents: 10000,
    costCents: 1000,
  });
});

test("customer CRUD roles, invalid data, and unused deletion audit", async () => {
  expect((await request("POST", "/customers", undefined, input())).status).toBe(401);
  for (const role of ["rep", "finance", "ops", "customer"] as Role[])
    expect((await request("POST", "/customers", role, input())).status).toBe(403);
  for (const role of ["manager", "admin"] as Role[]) {
    const response = await request("POST", "/customers", role, input());
    expect(response.status).toBe(200);
    const customer = await response.json();
    for (const denied of ["rep", "finance", "ops", "customer"] as Role[]) {
      expect((await request("PATCH", `/customers/${customer.id}`, denied, input())).status).toBe(
        403,
      );
      expect((await request("DELETE", `/customers/${customer.id}`, denied)).status).toBe(403);
    }
    expect(
      (
        await request("PATCH", `/customers/${customer.id}`, "manager", {
          ...customer,
          id: undefined,
          tier: "Platinum",
        })
      ).status,
    ).toBe(400);
    const updatedInput = { ...input(), tier: "Silver" as const };
    expect(
      (await request("PATCH", `/customers/${customer.id}`, "manager", updatedInput)).status,
    ).toBe(200);
    expect((await request("DELETE", `/customers/${customer.id}`, "admin")).status).toBe(200);
    expect(await db.select().from(customers).where(eq(customers.id, customer.id))).toHaveLength(0);
    expect(
      await db.select().from(profiles).where(eq(profiles.customerId, customer.id)),
    ).toHaveLength(0);
    expect(await db.select().from(user).where(eq(user.email, updatedInput.email))).toHaveLength(0);
    const recreated = await request("POST", "/customers", "manager", updatedInput);
    expect(recreated.status).toBe(200);
    const recreatedCustomer = await recreated.json();
    expect(recreatedCustomer.email).toBe(updatedInput.email);
    expect(
      await db.select().from(customers).where(eq(customers.email, updatedInput.email)),
    ).toHaveLength(1);
    expect(await db.select().from(user).where(eq(user.email, updatedInput.email))).toHaveLength(1);
    expect((await request("DELETE", `/customers/${recreatedCustomer.id}`, "admin")).status).toBe(
      200,
    );
    // Legacy unused customer records remain deletable.
    const unusedId = crypto.randomUUID();
    await db.insert(customers).values({ id: unusedId, ...input() });
    expect((await request("DELETE", `/customers/${unusedId}`, "admin")).status).toBe(200);
    expect((await request("DELETE", `/customers/${unusedId}`, "admin")).status).toBe(404);
    const audit = await db.select().from(auditEntries).where(eq(auditEntries.entityId, unusedId));
    expect(audit.some((entry) => entry.action === "CUSTOMER_DELETED")).toBe(true);
  }
});

test("tier changes affect new quotes, preserve old quotes and prevent customer deletion", async () => {
  const body = input();
  const customer = await (await request("POST", "/customers", "manager", body)).json();
  const quoteBody = {
    customerId: customer.id,
    lines: [{ productId, quantity: 1, discountBps: 1200 }],
    orderDiscountBps: 0,
  };
  const gold = await (await request("POST", "/quotes", "rep", quoteBody)).json();
  expect(gold.lines[0].priceCents).toBe(9000);
  expect(gold.risk).toBe("NONE");
  expect(
    (await request("PATCH", `/customers/${customer.id}`, "manager", { ...body, tier: "Silver" }))
      .status,
  ).toBe(200);
  const silver = await (await request("POST", "/quotes", "rep", quoteBody)).json();
  expect(silver.lines[0].priceCents).toBe(9500);
  expect(silver.risk).toBe("MEDIUM");
  const previous = await (await request("GET", `/quotes/${gold.id}`, "rep")).json();
  expect(previous.quote.lines[0].priceCents).toBe(9000);
  expect((await request("DELETE", `/customers/${customer.id}`, "manager")).status).toBe(409);
});

test("linked customer email edits update login, revoke sessions and reject conflicts atomically", async () => {
  const body = input();
  const [customer] = await db
    .insert(customers)
    .values({ id: crypto.randomUUID(), ...body })
    .returning();
  const password = `Test-${crypto.randomUUID()}`;
  const signup = await auth.api.signUpEmail({
    body: { email: body.email, name: body.name, password },
  });
  await db
    .insert(profiles)
    .values({ userId: signup.user.id, customerId: customer.id, role: "customer" });
  const oldSession = await auth.api.signInEmail({
    asResponse: true,
    body: { email: body.email, password },
  });
  const oldCookie = oldSession.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const newEmail = `changed-${crypto.randomUUID()}@example.com`;
  expect(
    (await request("PATCH", `/customers/${customer.id}`, "manager", { ...body, email: newEmail }))
      .status,
  ).toBe(200);
  expect(await auth.api.getSession({ headers: new Headers({ cookie: oldCookie }) })).toBeNull();
  const login = await auth.api.signInEmail({
    asResponse: true,
    body: { email: newEmail, password },
  });
  expect(login.ok).toBe(true);
  const oldLogin = await auth.api.signInEmail({
    asResponse: true,
    body: { email: body.email, password },
  });
  expect(oldLogin.ok).toBe(false);
  const conflict = `conflict-${crypto.randomUUID()}@example.com`;
  await auth.api.signUpEmail({ body: { email: conflict, name: "Other", password } });
  expect(
    (await request("PATCH", `/customers/${customer.id}`, "admin", { ...body, email: conflict }))
      .status,
  ).toBe(409);
  const [saved] = await db.select().from(customers).where(eq(customers.id, customer.id));
  expect(saved!.email).toBe(newEmail);
});
