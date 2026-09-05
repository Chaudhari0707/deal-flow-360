import { beforeAll, describe, expect, test } from "bun:test";

import { eq } from "drizzle-orm";

import { changeSubscription, recordPayment } from "@/features/billing/service";
import { tokenDigest } from "@/features/quotes/email";
import { confirmQuote, counterQuote, saveQuote, submitQuote } from "@/features/quotes/service";
import { createAuth } from "@/lib/auth/create-auth";
import { db } from "@/lib/db/connection";
import {
  customers,
  deliveries,
  invoices,
  messages,
  products,
  profiles,
  quoteAccess,
  quotes,
  subscriptions,
} from "@/lib/db/schema";
import type { Actor, Role } from "@/lib/domain/_types/domain";
import type { Workspace } from "@/lib/domain/_types/workspace";
import { api } from "@/server/api";

const accounts: Record<string, { actor: Actor; cookie: string }> = {};
const customerId = `access-customer-${crypto.randomUUID()}`;
const otherCustomerId = `access-customer-${crypto.randomUUID()}`;
const productId = `access-service-${crypto.randomUUID()}`;
const fixtures: {
  confirmedId: string;
  draftId: string;
  invoiceId: string;
  openId: string;
  orderId: string;
  subscriptionId: string;
}[] = [];

async function request(
  path: string,
  account?: string,
  method = "GET",
  body?: unknown,
  tokenCookie?: string,
) {
  return api.handle(
    new Request(`${Bun.env.BETTER_AUTH_URL}/api/v1${path}`, {
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      headers: {
        ...(method === "GET" ? {} : { origin: new URL(Bun.env.BETTER_AUTH_URL!).origin }),
        ...(account ? { cookie: accounts[account]!.cookie } : {}),
        ...(tokenCookie ? { cookie: tokenCookie } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      method,
    }),
  );
}

beforeAll(async () => {
  if (!new URL(Bun.env.DATABASE_URL!).pathname.endsWith("_test"))
    throw new Error("Access regression requires _test database");
  await db.insert(customers).values([
    { email: "scope-a@example.com", id: customerId, name: "Scope A" },
    { email: "scope-b@example.com", id: otherCustomerId, name: "Scope B" },
  ]);
  await db.insert(products).values({
    category: "Subscription",
    costCents: 1000,
    id: productId,
    intervalMonths: 1,
    name: "Scope service",
    priceCents: 10000,
  });
  for (const [name, role, customer] of [
    ["repA", "rep", null],
    ["repB", "rep", null],
    ["admin", "admin", null],
    ["manager", "manager", null],
    ["finance", "finance", null],
    ["ops", "ops", null],
    ["customer", "customer", customerId],
    ["otherCustomer", "customer", otherCustomerId],
  ] as [string, Role, string | null][]) {
    const id = crypto.randomUUID(),
      email = `scope-${id}@example.com`,
      password = `Scope-test-${id}`;
    const created = await createAuth(db).api.signUpEmail({
      body: { email, name: `Scope ${name}`, password },
    });
    await db.insert(profiles).values({ customerId: customer, role, userId: created.user.id });
    const session = await createAuth(db).api.signInEmail({
      asResponse: true,
      body: { email, password },
    });
    accounts[name] = {
      actor: { customerId: customer, email, id: created.user.id, name: `Scope ${name}`, role },
      cookie: session.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; "),
    };
  }
  for (const owner of ["repA", "repB"]) {
    const input = {
      customerId,
      lines: [{ discountBps: 0, productId, quantity: 1 }],
      orderDiscountBps: 0,
    };
    const draft = await saveQuote(input, accounts[owner]!.actor);
    const created = await saveQuote(input, accounts[owner]!.actor);
    const approved = await submitQuote(created.id, created.revision, accounts[owner]!.actor);
    const order = await confirmQuote(approved.id, approved.revision, accounts.customer!.actor);
    const [invoice] = await db.select().from(invoices).where(eq(invoices.orderId, order.id));
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.orderId, order.id));
    await recordPayment(accounts.finance!.actor, invoice!.id, crypto.randomUUID(), "Scope payment");
    await changeSubscription(
      accounts.finance!.actor,
      subscription!.id,
      { operationKey: crypto.randomUUID(), reason: "Scope cancellation", version: 1 },
      true,
    );
    const open = await saveQuote(input, accounts[owner]!.actor);
    await submitQuote(open.id, open.revision, accounts[owner]!.actor);
    await db.insert(messages).values({
      authorId: accounts[owner]!.actor.id,
      authorName: "Scope rep",
      body: `Private thread ${owner}`,
      id: crypto.randomUUID(),
      quoteId: approved.id,
    });
    await db.insert(deliveries).values({
      encryptedPayload: "opaque-test-payload",
      id: crypto.randomUUID(),
      quoteId: approved.id,
      revision: approved.revision,
      status: "FAILED",
    });
    fixtures.push({
      confirmedId: approved.id,
      draftId: draft.id,
      invoiceId: invoice!.id,
      openId: open.id,
      orderId: order.id,
      subscriptionId: subscription!.id,
    });
  }
});

describe("internal and portal ownership boundaries", () => {
  test("representative aggregate exposes only own quote-linked data even for a shared customer", async () => {
    const response = await request("/workspace", "repA");
    expect(response.status).toBe(200);
    const data = (await response.json()) as Workspace;
    expect(data.quotes.every((quote) => quote.ownerId === accounts.repA!.actor.id)).toBe(true);
    expect(data.quotes.some((quote) => quote.id === fixtures[0]!.confirmedId)).toBe(true);
    expect(data.orders.map((order) => order.id)).toContain(fixtures[0]!.orderId);
    expect(data.orders.map((order) => order.id)).not.toContain(fixtures[1]!.orderId);
    expect(data.subscriptions.map((subscription) => subscription.id)).toContain(
      fixtures[0]!.subscriptionId,
    );
    expect(data.subscriptions.map((subscription) => subscription.id)).not.toContain(
      fixtures[1]!.subscriptionId,
    );
    expect(data.invoices.map((invoice) => invoice.id)).toContain(fixtures[0]!.invoiceId);
    expect(data.invoices.map((invoice) => invoice.id)).not.toContain(fixtures[1]!.invoiceId);
    expect(data.payments.every((payment) => payment.invoiceId === fixtures[0]!.invoiceId)).toBe(
      true,
    );
    expect(data.payments).toHaveLength(1);
    expect(data.credits.every((credit) => credit.invoiceId === fixtures[0]!.invoiceId)).toBe(true);
    expect(data.credits).toHaveLength(1);
    expect(data.messages.every((message) => message.quoteId === fixtures[0]!.confirmedId)).toBe(
      true,
    );
    expect(data.deliveries.every((delivery) => delivery.quoteId === fixtures[0]!.confirmedId)).toBe(
      true,
    );
    const forbiddenIds = Object.values(fixtures[1]!);
    expect(data.activity.every((entry) => !forbiddenIds.includes(entry.entityId))).toBe(true);
    expect(JSON.stringify(data.deliveries)).not.toContain("encryptedPayload");
  });
  test("Ops has no financial datasets or financial audit events; management retains both representatives", async () => {
    const ops = (await (await request("/workspace", "ops")).json()) as Workspace;
    expect([ops.subscriptions, ops.invoices, ops.payments, ops.credits]).toEqual([[], [], [], []]);
    expect(
      ops.activity.some((entry) =>
        [
          fixtures[0]!.invoiceId,
          fixtures[1]!.invoiceId,
          fixtures[0]!.subscriptionId,
          fixtures[1]!.subscriptionId,
        ].includes(entry.entityId),
      ),
    ).toBe(false);
    for (const role of ["admin", "manager", "finance"]) {
      const data = (await (await request("/workspace", role)).json()) as Workspace;
      expect(data.invoices.some((invoice) => invoice.id === fixtures[0]!.invoiceId)).toBe(true);
      expect(data.invoices.some((invoice) => invoice.id === fixtures[1]!.invoiceId)).toBe(true);
    }
    expect((await request("/workspace", "customer")).status).toBe(403);
    expect((await request("/workspace")).status).toBe(401);
  });
  test("cross-owner representative GET, edit, submit and send are rejected without changing state", async () => {
    const foreign = fixtures[1]!;
    expect((await request(`/quotes/${foreign.draftId}`, "repA")).status).toBe(404);
    expect(
      (
        await request(`/quotes/${foreign.draftId}`, "repA", "PATCH", {
          customerId,
          lines: [{ discountBps: 0, productId, quantity: 2 }],
          orderDiscountBps: 0,
          revision: 1,
        })
      ).status,
    ).toBe(404);
    expect(
      (await request(`/quotes/${foreign.draftId}/submit`, "repA", "POST", { revision: 1 })).status,
    ).toBe(404);
    expect((await request(`/quotes/${foreign.openId}/send`, "repA", "POST")).status).toBe(404);
    const [unchanged] = await db.select().from(quotes).where(eq(quotes.id, foreign.draftId));
    expect(unchanged?.revision).toBe(1);
    expect(unchanged?.status).toBe("DRAFT");
    expect((await request(`/quotes/${fixtures[0]!.draftId}`, "repA")).status).toBe(200);
    await expect(submitQuote(foreign.draftId, 1, accounts.repA!.actor)).rejects.toThrow(
      "not found",
    );
  });
  test("portal lists and details are customer-only even when staff owns a quotation", async () => {
    for (const role of ["repA", "repB", "manager", "finance", "ops", "admin"])
      for (const path of ["/portal", `/portal/${fixtures[0]!.confirmedId}`])
        expect((await request(path, role)).status).toBe(403);
    expect((await request(`/portal/${fixtures[0]!.confirmedId}`, "otherCustomer")).status).toBe(
      404,
    );
    const customer = (await (await request("/portal", "customer")).json()) as {
      quotes: { id: string }[];
    };
    expect(customer.quotes.some((quote) => quote.id === fixtures[0]!.confirmedId)).toBe(true);
    expect(customer.quotes.some((quote) => quote.id === fixtures[1]!.confirmedId)).toBe(true);
  });
  test("staff cannot masquerade as a customer through any portal mutation", async () => {
    const id = fixtures[0]!.openId;
    const [before] = await db.select().from(quotes).where(eq(quotes.id, id));
    for (const role of ["repA", "manager", "finance", "ops", "admin"]) {
      expect(
        (
          await request(`/portal/${id}/counter`, role, "POST", {
            lines: [],
            revision: before!.revision,
          })
        ).status,
      ).toBe(403);
      expect(
        (await request(`/portal/${id}/confirm`, role, "POST", { revision: before!.revision }))
          .status,
      ).toBe(403);
      if (role !== "admin") {
        await expect(confirmQuote(id, before!.revision, accounts[role]!.actor)).rejects.toThrow(
          "Only the customer",
        );
        await expect(counterQuote(id, before!.revision, [], accounts[role]!.actor)).rejects.toThrow(
          "Only the customer",
        );
      }
    }
    for (const role of ["repA", "manager", "finance", "ops", "admin"])
      expect(
        (await request(`/portal/${id}/message`, role, "POST", { body: "Unauthorized message" }))
          .status,
      ).toBe(403);
    expect(
      (await request(`/portal/${id}/message`, "customer", "POST", { body: "Authorized follow-up" }))
        .status,
    ).toBe(200);
    const [after] = await db.select().from(quotes).where(eq(quotes.id, id));
    expect(after?.revision).toBe(before?.revision);
    expect(after?.status).not.toBe("CONFIRMED");
  });
  test("redeemed tokens are exact-quote scoped even across the same customer", async () => {
    const token = crypto.randomUUID() + crypto.randomUUID();
    await db.insert(quoteAccess).values({
      digest: await tokenDigest(token),
      expiresAt: new Date(Date.now() + 60000),
      id: crypto.randomUUID(),
      quoteId: fixtures[0]!.confirmedId,
    });
    const redeemed = await request("/portal/redeem", undefined, "POST", { token });
    expect(redeemed.status).toBe(200);
    const cookie = redeemed.headers.get("set-cookie")!.split(";")[0]!;
    const listed = (await (
      await request("/portal", undefined, "GET", undefined, cookie)
    ).json()) as { quotes: { id: string }[] };
    expect(listed.quotes.map((quote) => quote.id)).toEqual([fixtures[0]!.confirmedId]);
    expect(
      (await request(`/portal/${fixtures[1]!.confirmedId}`, undefined, "GET", undefined, cookie))
        .status,
    ).toBe(404);
    expect(
      (
        await request(
          `/portal/${fixtures[1]!.confirmedId}/confirm`,
          undefined,
          "POST",
          { revision: 2 },
          cookie,
        )
      ).status,
    ).toBe(404);
  });
});
