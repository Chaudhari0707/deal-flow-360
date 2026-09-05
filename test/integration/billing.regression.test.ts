import { beforeAll, describe, expect, test } from "bun:test";

import { and, eq, inArray } from "drizzle-orm";

import { createOrderBilling } from "@/features/billing/creation";
import { financialReport } from "@/features/billing/reports";
import { changeSubscription, recordPayment, runDueBilling } from "@/features/billing/service";
import { createAuth } from "@/lib/auth/create-auth";
import { db } from "@/lib/db/connection";
import {
  auditEntries,
  credits,
  customers,
  invoices,
  orders,
  payments,
  products,
  profiles,
  quotes,
  subscriptions,
} from "@/lib/db/schema";
import type { Actor, QuoteLine } from "@/lib/domain/_types/domain";
import { api } from "@/server/api";

let actor: Actor;
let cookie: string;
const now = new Date("2026-04-01T12:00:00Z");

beforeAll(async () => {
  const url = new URL(Bun.env.DATABASE_URL!);
  if (!url.pathname.endsWith("_test"))
    throw new Error("Billing tests require dedicated _test database");
  const id = crypto.randomUUID();
  const result = await createAuth(db).api.signUpEmail({
    body: {
      email: `billing-${id}@example.com`,
      name: "Billing test finance",
      password: `Billing-test-${id}`,
    },
  });
  actor = {
    customerId: null,
    email: result.user.email,
    id: result.user.id,
    name: result.user.name,
    role: "finance",
  };
  await db.insert(profiles).values({ role: "finance", userId: actor.id });
  const signedIn = await createAuth(db).api.signInEmail({
    asResponse: true,
    body: { email: actor.email, password: `Billing-test-${id}` },
  });
  cookie = signedIn.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
});

async function fixture(free = false) {
  const id = crypto.randomUUID();
  const customerId = `billing-customer-${id}`,
    productId = `billing-product-${id}`;
  const line: QuoteLine = {
    category: "Service",
    costCents: 0,
    discountBps: 0,
    id: `line-${id}`,
    intervalMonths: 1,
    name: "Monthly service",
    netCents: free ? 0 : 4600,
    priceCents: free ? 0 : 4600,
    productId,
    quantity: 1,
    stockable: false,
    taxBps: 0,
    taxCents: 0,
    totalCents: free ? 0 : 4600,
    variant: "Standard",
  };
  const physical: QuoteLine = {
    ...line,
    id: `hardware-${id}`,
    intervalMonths: 0,
    name: "Backordered hardware",
    discountBps: free ? 10000 : 0,
    netCents: free ? 0 : 10000,
    priceCents: 10000,
    stockable: true,
    totalCents: free ? 0 : 10000,
  };
  await db.insert(customers).values({
    email: `billing-customer-${id}@example.com`,
    id: customerId,
    name: "Billing fixture",
  });
  await db.insert(products).values({
    category: "Service",
    costCents: 0,
    id: productId,
    intervalMonths: 1,
    name: "Monthly service",
    priceCents: free ? 0 : 4600,
  });
  await db.insert(quotes).values({
    customerId,
    id: `quote-${id}`,
    lines: [physical, line],
    number: `QB-${id}`,
    ownerId: actor.id,
    status: "CONFIRMED",
  });
  const [order] = await db
    .insert(orders)
    .values({
      customerId,
      fulfillmentStatus: "BACKORDER",
      id: `order-${id}`,
      lines: [physical, line],
      number: `OB-${id}`,
      quoteId: `quote-${id}`,
    })
    .returning();
  await db.transaction((tx) => createOrderBilling(tx, order!, now));
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orderId, order!.id));
  const initial = await db.select().from(invoices).where(eq(invoices.orderId, order!.id));
  return { customerId, initial, order: order!, subscription: subscription! };
}

describe("billing transaction regressions", () => {
  test("zero balance invoices settle without fictional payments and recurring renewals stay settled", async () => {
    const data = await fixture(true);
    expect(data.initial).toHaveLength(2);
    expect(
      data.initial.every(
        (invoice) =>
          invoice.totalCents === 0 && invoice.status === "PAID" && invoice.paidCents === 0,
      ),
    ).toBe(true);
    expect(
      await db
        .select()
        .from(payments)
        .where(
          inArray(
            payments.invoiceId,
            data.initial.map((invoice) => invoice.id),
          ),
        ),
    ).toHaveLength(0);
    await expect(
      recordPayment(actor, data.initial[0]!.id, crypto.randomUUID(), "FREE-INVOICE"),
    ).rejects.toThrow("no outstanding balance");
    await db.transaction((tx) => createOrderBilling(tx, data.order, now));
    await runDueBilling(actor, new Date("2026-05-01"));
    const recurring = await db
      .select()
      .from(invoices)
      .where(eq(invoices.subscriptionId, data.subscription.id));
    expect(recurring).toHaveLength(2);
    expect(recurring.every((invoice) => invoice.status === "PAID" && invoice.paidCents === 0)).toBe(
      true,
    );
    const paidReport = await financialReport({ customerId: data.customerId, status: "PAID" });
    expect(paidReport.rows).toHaveLength(3);
    expect(
      (await financialReport({ customerId: data.customerId, status: "UNPAID" })).rows,
    ).toHaveLength(0);
    const charged = await fixture();
    expect(
      charged.initial.every((invoice) => invoice.totalCents > 0 && invoice.status === "UNPAID"),
    ).toBe(true);
  });

  test("HTTP contracts require a genuine session, finance permission and valid input", async () => {
    const data = await fixture();
    const invoice = data.initial[0]!;
    const path = `${Bun.env.BETTER_AUTH_URL}/api/v1/invoices/${invoice.id}`;
    expect((await api.handle(new Request(`${path}/pdf`))).status).toBe(401);
    const pdf = await api.handle(new Request(`${path}/pdf`, { headers: { cookie } }));
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect((await pdf.arrayBuffer()).byteLength).toBeGreaterThan(100);
    const malformed = await api.handle(
      new Request(`${path}/pay`, {
        method: "POST",
        headers: {
          cookie,
          origin: new URL(Bun.env.BETTER_AUTH_URL!).origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({ operationKey: "short", reference: "x" }),
      }),
    );
    expect(malformed.status).toBe(400);
    await db.update(profiles).set({ role: "ops" }).where(eq(profiles.userId, actor.id));
    try {
      expect((await api.handle(new Request(`${path}/pdf`, { headers: { cookie } }))).status).toBe(
        403,
      );
      const forbidden = await api.handle(
        new Request(`${path}/pay`, {
          method: "POST",
          headers: {
            cookie,
            origin: new URL(Bun.env.BETTER_AUTH_URL!).origin,
            "content-type": "application/json",
          },
          body: JSON.stringify({ operationKey: crypto.randomUUID(), reference: "BANK" }),
        }),
      );
      expect(forbidden.status).toBe(403);
    } finally {
      await db.update(profiles).set({ role: "finance" }).where(eq(profiles.userId, actor.id));
    }
    expect(await db.select().from(payments).where(eq(payments.invoiceId, invoice.id))).toHaveLength(
      0,
    );
  });
  test("recorded health nudges persist in the activity feed and retries reuse the same record", async () => {
    const data = await fixture();
    const body = {
      operationKey: crypto.randomUUID(),
      quoteId: data.order.quoteId,
      reason: "Follow up with the deal owner",
    };
    const request = () =>
      new Request(`${Bun.env.BETTER_AUTH_URL}/api/v1/health/nudge`, {
        method: "POST",
        headers: {
          cookie,
          origin: new URL(Bun.env.BETTER_AUTH_URL!).origin,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
    const responses = await Promise.all([api.handle(request()), api.handle(request())]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const entries = await db
      .select()
      .from(auditEntries)
      .where(
        and(eq(auditEntries.entityId, data.order.quoteId), eq(auditEntries.action, "HEALTH_NUDGE")),
      );
    expect(entries).toHaveLength(1);
    expect(entries[0]?.detail?.ownerId).toBe(actor.id);
    expect(entries[0]?.reason).toBe(body.reason);
  });
  test("quantity changes preserve the original rational price without penny drift", async () => {
    const data = await fixture();
    await db
      .update(subscriptions)
      .set({ periodNetCents: 4600, priceBasisCents: 4600, priceBasisQuantity: 3, quantity: 3 })
      .where(eq(subscriptions.id, data.subscription.id));
    const down = await changeSubscription(
      actor,
      data.subscription.id,
      { operationKey: crypto.randomUUID(), quantity: 2, reason: "Reduce quantity", version: 1 },
      false,
      new Date("2026-04-16"),
    );
    expect(down?.periodNetCents).toBe(3067);
    const up = await changeSubscription(
      actor,
      data.subscription.id,
      {
        operationKey: crypto.randomUUID(),
        quantity: 3,
        reason: "Restore quantity",
        version: down!.version,
      },
      false,
      new Date("2026-04-16"),
    );
    expect(up?.periodNetCents).toBe(4600);
  });
  test("concurrent cancellation issues one bounded credit and one version wins", async () => {
    const data = await fixture();
    const attempts = await Promise.allSettled(
      [1, 2].map(() =>
        changeSubscription(
          actor,
          data.subscription.id,
          { operationKey: crypto.randomUUID(), reason: "Cancel simultaneously", version: 1 },
          true,
          new Date("2026-04-16"),
        ),
      ),
    );
    expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const notes = await db
      .select()
      .from(credits)
      .where(eq(credits.subscriptionId, data.subscription.id));
    expect(notes.reduce((sum, note) => sum + note.amountCents, 0)).toBe(2300);
    expect(notes).toHaveLength(1);
  });
  test("simultaneous payment and credit keep the source balance conserved", async () => {
    const data = await fixture();
    const invoice = data.initial.find((row) => row.kind === "RECURRING")!;
    await Promise.all([
      recordPayment(actor, invoice.id, crypto.randomUUID(), "RACE-PAYMENT"),
      changeSubscription(
        actor,
        data.subscription.id,
        { operationKey: crypto.randomUUID(), reason: "Cancel during settlement", version: 1 },
        true,
        new Date("2026-04-16"),
      ),
    ]);
    const [updated] = await db.select().from(invoices).where(eq(invoices.id, invoice.id));
    const [note] = await db.select().from(credits).where(eq(credits.invoiceId, invoice.id));
    expect(updated!.paidCents + updated!.creditedCents).toBe(4600);
    expect(note!.amountCents).toBe(2300);
    expect(updated!.paidCents - (note!.amountCents - note!.appliedCents)).toBe(2300);
  });
  test("confirmation bills full backorder plus separate recurring and retries cannot duplicate", async () => {
    const data = await fixture();
    await db.transaction((tx) => createOrderBilling(tx, data.order, now));
    const persisted = await db.select().from(invoices).where(eq(invoices.orderId, data.order.id));
    expect(persisted).toHaveLength(2);
    expect(persisted.find((row) => row.kind === "ONE_TIME")?.totalCents).toBe(10000);
    expect(persisted.find((row) => row.kind === "RECURRING")?.totalCents).toBe(4600);
    expect(data.subscription.periodStart).toBe("2026-04-01");
    expect(data.subscription.periodEnd).toBe("2026-05-01");
  });
  test("concurrent full payment with one identity creates one payment ledger row", async () => {
    const data = await fixture();
    const invoice = data.initial.find((row) => row.kind === "ONE_TIME")!;
    const operationKey = crypto.randomUUID();
    const attempts = await Promise.all([
      recordPayment(actor, invoice.id, operationKey, "BANK-RETRY"),
      recordPayment(actor, invoice.id, operationKey, "BANK-RETRY"),
    ]);
    expect(attempts[0].payment?.id).toBe(attempts[1].payment?.id);
    const ledger = await db.select().from(payments).where(eq(payments.invoiceId, invoice.id));
    expect(ledger).toHaveLength(1);
    expect(ledger[0]?.amountCents).toBe(10000);
    await expect(recordPayment(actor, invoice.id, crypto.randomUUID(), "BANK-NEW")).rejects.toThrow(
      "no outstanding balance",
    );
    await expect(recordPayment(actor, invoice.id, operationKey, "DIFFERENT")).rejects.toThrow(
      "already used",
    );
  });
  test("midperiod quantity increase and cancellation reconcile exact credits and preserve invoices", async () => {
    const data = await fixture();
    const input = {
      operationKey: crypto.randomUUID(),
      quantity: 2,
      reason: "Customer doubles service",
      version: 1,
    };
    const changed = await changeSubscription(
      actor,
      data.subscription.id,
      input,
      false,
      new Date("2026-04-16T10:00:00Z"),
    );
    await changeSubscription(
      actor,
      data.subscription.id,
      input,
      false,
      new Date("2026-04-16T10:00:00Z"),
    );
    let persisted = await db
      .select()
      .from(invoices)
      .where(eq(invoices.subscriptionId, data.subscription.id));
    expect(persisted).toHaveLength(2);
    expect(persisted.find((row) => row.kind === "ADJUSTMENT")?.totalCents).toBe(2300);
    await changeSubscription(
      actor,
      data.subscription.id,
      {
        operationKey: crypto.randomUUID(),
        reason: "Customer cancels service",
        version: changed!.version,
      },
      true,
      new Date("2026-04-16T10:00:00Z"),
    );
    const notes = await db
      .select()
      .from(credits)
      .where(eq(credits.subscriptionId, data.subscription.id));
    expect(notes.reduce((sum, row) => sum + row.amountCents, 0)).toBe(4600);
    persisted = await db
      .select()
      .from(invoices)
      .where(eq(invoices.subscriptionId, data.subscription.id));
    expect(persisted).toHaveLength(2);
    expect(persisted.reduce((sum, row) => sum + row.totalCents - row.creditedCents, 0)).toBe(2300);
    const [cancelled] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, data.subscription.id));
    expect(cancelled?.status).toBe("CANCELLED");
  });
  test("paid cancellation retains available credit without inventing a cash refund", async () => {
    const data = await fixture();
    const invoice = data.initial.find((row) => row.kind === "RECURRING")!;
    await recordPayment(actor, invoice.id, crypto.randomUUID(), "PREPAID");
    await changeSubscription(
      actor,
      data.subscription.id,
      { operationKey: crypto.randomUUID(), reason: "Cancel prepaid plan", version: 1 },
      true,
      new Date("2026-04-16T00:00:00Z"),
    );
    const [credit] = await db
      .select()
      .from(credits)
      .where(eq(credits.subscriptionId, data.subscription.id));
    expect(credit?.amountCents).toBe(2300);
    expect(credit?.appliedCents).toBe(0);
    const [persisted] = await db.select().from(invoices).where(eq(invoices.id, invoice.id));
    expect(persisted?.paidCents).toBe(4600);
  });
  test("stale version conflict rolls back invoice and credit effects", async () => {
    const data = await fixture();
    await expect(
      changeSubscription(
        actor,
        data.subscription.id,
        { operationKey: crypto.randomUUID(), quantity: 2, reason: "Stale version", version: 99 },
        false,
        new Date("2026-04-16"),
      ),
    ).rejects.toThrow("changed");
    expect(
      await db.select().from(invoices).where(eq(invoices.subscriptionId, data.subscription.id)),
    ).toHaveLength(1);
    expect(
      await db.select().from(credits).where(eq(credits.subscriptionId, data.subscription.id)),
    ).toHaveLength(0);
  });
  test("due billing catches missed periods exactly once and cancellation stops future runs", async () => {
    const data = await fixture();
    await Promise.all([
      runDueBilling(actor, new Date("2026-06-01")),
      runDueBilling(actor, new Date("2026-06-01")),
    ]);
    const persisted = await db
      .select()
      .from(invoices)
      .where(
        and(eq(invoices.subscriptionId, data.subscription.id), eq(invoices.kind, "RECURRING")),
      );
    expect(persisted).toHaveLength(3);
    expect(persisted.map((row) => row.periodStart).sort()).toEqual([
      "2026-04-01",
      "2026-05-01",
      "2026-06-01",
    ]);
    const [current] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, data.subscription.id));
    await changeSubscription(
      actor,
      current!.id,
      { operationKey: crypto.randomUUID(), reason: "Stop renewal", version: current!.version },
      true,
      new Date("2026-06-16"),
    );
    await runDueBilling(actor, new Date("2026-07-01"));
    expect(
      await db.select().from(invoices).where(eq(invoices.subscriptionId, current!.id)),
    ).toHaveLength(3);
  });
  test("report customer filters reconcile actual persisted invoice totals", async () => {
    const data = await fixture();
    const report = await financialReport({ customerId: data.customerId });
    expect(report.rows).toHaveLength(2);
    expect(report.totals).toEqual({ billedCents: 14600, outstandingCents: 14600, paidCents: 0 });
    await expect(financialReport({ from: "2026-09-02", to: "2026-09-01" })).rejects.toThrow(
      "before",
    );
  });
});
