import { beforeAll, describe, expect, test } from "bun:test";

import { eq } from "drizzle-orm";

import { tokenDigest } from "@/features/quotes/email";
import { createAuth } from "@/lib/auth/create-auth";
import { db } from "@/lib/db/connection";
import {
  customers,
  invoices,
  messages,
  orders,
  products,
  profiles,
  quoteAccess,
  quotes,
} from "@/lib/db/schema";
import type { QuoteLine, Role } from "@/lib/domain/_types/domain";
import { api } from "@/server/api";

let ownerId: string;

beforeAll(async () => {
  if (!new URL(Bun.env.DATABASE_URL!).pathname.endsWith("_test"))
    throw new Error("Portal tests require dedicated _test database");
  const identifier = crypto.randomUUID();
  const result = await createAuth(db).api.signUpEmail({
    body: {
      email: `portal-owner-${identifier}@example.com`,
      name: "Portal fixture owner",
      password: `Portal-test-${identifier}`,
    },
  });
  ownerId = result.user.id;
});

async function fixture() {
  const id = crypto.randomUUID();
  const customerId = `portal-customer-${id}`;
  const productId = `portal-product-${id}`;
  const quoteId = `portal-quote-${id}`;
  await db
    .insert(customers)
    .values({ id: customerId, name: "Portal fixture customer", email: `portal-${id}@example.com` });
  await db.insert(products).values({
    id: productId,
    name: "Implementation",
    category: "Services",
    priceCents: 10000,
    costCents: 3000,
  });
  const line: QuoteLine = {
    category: "Services",
    costCents: 3000,
    discountBps: 0,
    id: `line-${id}`,
    intervalMonths: 0,
    name: "Implementation",
    netCents: 10000,
    priceCents: 10000,
    productId,
    quantity: 1,
    stockable: false,
    taxBps: 0,
    taxCents: 0,
    totalCents: 10000,
    variant: "Standard",
  };
  await db.insert(quotes).values({
    id: quoteId,
    number: `Q-${id}`,
    ownerId,
    customerId,
    lines: [line],
    status: "SENT",
    revision: 1,
    approvedRevision: 1,
    subtotalCents: 10000,
    totalCents: 10000,
    marginCents: 7000,
    notes: "Private internal pricing note",
  });
  const token = crypto.randomUUID() + crypto.randomUUID();
  await db.insert(quoteAccess).values({
    id: `access-${id}`,
    quoteId,
    digest: await tokenDigest(token),
    expiresAt: new Date(Date.now() + 60000),
  });
  return { customerId, line, quoteId, token };
}

async function request(path: string, method = "GET", cookie?: string, body?: unknown) {
  return api.handle(
    new Request(`http://localhost/api/v1${path}`, {
      method,
      headers: {
        ...(method === "GET" ? {} : { origin: new URL(Bun.env.BETTER_AUTH_URL!).origin }),
        ...(cookie ? { cookie } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}

async function access(token: string) {
  const response = await request("/portal/redeem", "POST", undefined, { token });
  expect(response.status).toBe(200);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  expect(cookie).toStartWith("dealflow_portal=");
  return cookie!;
}

async function authenticatedCookie(role: Role, customerId: string | null = null) {
  const id = crypto.randomUUID();
  const email = `portal-${role}-${id}@example.com`;
  const password = `Portal-${id}`;
  const auth = createAuth(db);
  const result = await auth.api.signUpEmail({ body: { email, name: `Portal ${role}`, password } });
  await db.insert(profiles).values({ customerId, role, userId: result.user.id });
  const session = await auth.api.signInEmail({ asResponse: true, body: { email, password } });
  return session.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}

describe("portal scoped access regressions", () => {
  test("single-use token redemption is atomic under concurrent requests", async () => {
    const item = await fixture();
    const responses = await Promise.all([
      request("/portal/redeem", "POST", undefined, { token: item.token }),
      request("/portal/redeem", "POST", undefined, { token: item.token }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 410]);
    const success = responses.find((response) => response.status === 200)!;
    expect(success.headers.get("set-cookie")).toContain("HttpOnly");
    expect(success.headers.get("set-cookie")).toContain("SameSite=Lax");
  });

  test("quote token cannot read or mutate another customer's quotation", async () => {
    const own = await fixture(),
      other = await fixture();
    const cookie = await access(own.token);
    const list = await request("/portal", "GET", cookie);
    expect(list.status).toBe(200);
    const payload = (await list.json()) as { quotes: { id: string }[] };
    expect(payload.quotes.map((quote) => quote.id)).toEqual([own.quoteId]);
    expect((await request(`/portal/${other.quoteId}`, "GET", cookie)).status).toBe(404);
    for (const [action, body] of [
      ["message", { body: "Unauthorized message" }],
      ["counter", { revision: 1, lines: [{ id: other.line.id, discountBps: 1000 }] }],
      ["confirm", { revision: 1 }],
    ] as const)
      expect(
        (await request(`/portal/${other.quoteId}/${action}`, "POST", cookie, body)).status,
      ).toBe(404);
    expect(
      await db.select().from(messages).where(eq(messages.quoteId, other.quoteId)),
    ).toHaveLength(0);
    expect(await db.select().from(orders).where(eq(orders.quoteId, other.quoteId))).toHaveLength(0);
  });

  test("real customer sessions stay scoped while every staff role is denied portal access", async () => {
    const item = await fixture();
    const customerCookie = await authenticatedCookie("customer", item.customerId);
    const customerList = await request("/portal", "GET", customerCookie);
    expect(customerList.status).toBe(200);
    expect(((await customerList.json()) as { quotes: { id: string }[] }).quotes).toEqual([
      expect.objectContaining({ id: item.quoteId }),
    ]);

    for (const role of ["admin", "finance", "manager", "ops", "rep"] as const) {
      const cookie = await authenticatedCookie(role);
      expect((await request("/portal", "GET", cookie)).status).toBe(403);
      expect((await request(`/portal/${item.quoteId}`, "GET", cookie)).status).toBe(403);
      expect(
        (
          await request(`/portal/${item.quoteId}/message`, "POST", cookie, {
            body: "Staff cannot post through a customer portal.",
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await request(`/portal/${item.quoteId}/counter`, "POST", cookie, {
            lines: [{ discountBps: 0, id: item.line.id }],
            revision: 1,
          })
        ).status,
      ).toBe(403);
      expect(
        (await request(`/portal/${item.quoteId}/confirm`, "POST", cookie, { revision: 1 })).status,
      ).toBe(403);
    }
    expect(await db.select().from(messages).where(eq(messages.quoteId, item.quoteId))).toHaveLength(
      0,
    );
    expect(await db.select().from(orders).where(eq(orders.quoteId, item.quoteId))).toHaveLength(0);
  });

  test("public quotation excludes internal costs, margins, risk and notes", async () => {
    const item = await fixture();
    const cookie = await access(item.token);
    const response = await request(`/portal/${item.quoteId}`, "GET", cookie);
    const payload = (await response.json()) as {
      quote: Record<string, unknown> & { lines: Record<string, unknown>[] };
    };
    expect(response.status).toBe(200);
    expect(payload.quote.totalCents).toBe(10000);
    for (const key of ["costCents", "marginCents", "riskSnapshot", "notes", "ownerId"])
      expect(payload.quote).not.toHaveProperty(key);
    expect(payload.quote.lines[0]).not.toHaveProperty("costCents");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  test("line conversation preserves approved confirmation and retries create one order", async () => {
    const item = await fixture();
    const cookie = await access(item.token);
    expect(
      (
        await request(`/portal/${item.quoteId}/message`, "POST", cookie, {
          body: "Can you confirm the delivery contact?",
          lineId: item.line.id,
        })
      ).status,
    ).toBe(200);
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, item.quoteId));
    expect(quote?.status).toBe("UNDER_NEGOTIATION");
    expect(quote?.approvedRevision).toBe(1);
    expect(
      (await request(`/portal/${item.quoteId}/confirm`, "POST", cookie, { revision: 2 })).status,
    ).toBe(409);
    const results = await Promise.all([
      request(`/portal/${item.quoteId}/confirm`, "POST", cookie, { revision: 1 }),
      request(`/portal/${item.quoteId}/confirm`, "POST", cookie, { revision: 1 }),
    ]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    const savedOrders = await db.select().from(orders).where(eq(orders.quoteId, item.quoteId));
    expect(savedOrders).toHaveLength(1);
    const savedInvoices = await db
      .select()
      .from(invoices)
      .where(eq(invoices.orderId, savedOrders[0]!.id));
    expect(savedInvoices).toHaveLength(1);
    expect(savedInvoices[0]?.totalCents).toBe(10000);
  });

  test("logout revokes the granted quote session", async () => {
    const item = await fixture();
    const cookie = await access(item.token);
    expect((await request("/portal/logout", "POST", cookie)).status).toBe(200);
    expect((await request(`/portal/${item.quoteId}`, "GET", cookie)).status).toBe(401);
  });
});

test("portal rejects missing and opaque origins before redeeming a valid access token", async () => {
  const item = await fixture();
  for (const origin of [undefined, "null", "https://untrusted.example"]) {
    const response = await api.handle(
      new Request("http://localhost/api/v1/portal/redeem", {
        method: "POST",
        headers: { "content-type": "application/json", ...(origin ? { origin } : {}) },
        body: JSON.stringify({ token: item.token }),
      }),
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
  }
  const redeemed = await request("/portal/redeem", "POST", undefined, { token: item.token });
  expect(redeemed.status).toBe(200);
  const cookie = redeemed.headers.get("set-cookie")!.split(";")[0]!;
  const logout = await api.handle(
    new Request("http://localhost/api/v1/portal/logout", { method: "POST", headers: { cookie } }),
  );
  expect(logout.status).toBe(403);
  expect((await request(`/portal/${item.quoteId}`, "GET", cookie)).status).toBe(200);
});

test("configured trailing slash does not reject the canonical browser origin", async () => {
  const previous = Bun.env.BETTER_AUTH_URL;
  const item = await fixture();
  try {
    Bun.env.BETTER_AUTH_URL = `${new URL(previous!).origin}/`;
    expect((await request("/portal/redeem", "POST", undefined, { token: item.token })).status).toBe(
      200,
    );
  } finally {
    Bun.env.BETTER_AUTH_URL = previous;
  }
});
