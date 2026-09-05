import { eq } from "drizzle-orm";

import { createOrderBilling } from "@/features/billing/creation";
import {
  calculateQuote,
  defaultDiscounts,
  defaultPricelists,
  priceLines,
} from "@/features/quotes/rules";
import { createAuth } from "@/lib/auth/create-auth";
import type { Database } from "@/lib/db/_types/database";
import * as s from "@/lib/db/schema";
import { customerRows, productRows } from "@/lib/db/seed/demo-data";
import type { QuoteStatus, Role } from "@/lib/domain/_types/domain";

export async function seedDemo(database: Database) {
  const password =
    Bun.env.DEMO_PASSWORD ?? Bun.env.SEED_AUTH_PASSWORD ?? Bun.env.PLAYWRIGHT_USER_PASSWORD;
  if (!password || password.length < 12)
    throw new Error("Set DEMO_PASSWORD (at least 12 characters) for local synthetic accounts");
  await database.transaction(async (tx) => {
    await tx.insert(s.customers).values(customerRows).onConflictDoNothing();
    await tx.insert(s.products).values(productRows).onConflictDoNothing();
    await tx
      .insert(s.settings)
      .values([
        { id: "discounts", value: defaultDiscounts },
        { id: "pricelists", value: defaultPricelists },
        {
          id: "health",
          value: {
            staleDays: 7,
            approvalDays: 2,
            overdueDays: 1,
            anomalyBps: 1000,
            historyDays: 90,
          },
        },
        { id: "upsell", value: { minimumMarginBps: 2000 } },
        { id: "approvalChain", value: { manager: 1, finance: 2 } },
      ])
      .onConflictDoNothing();
    const [health] = await tx.select().from(s.settings).where(eq(s.settings.id, "health"));
    if (
      health &&
      typeof health.value.stallDays === "number" &&
      health.value.staleDays === undefined
    ) {
      const { stallDays, ...retained } = health.value;
      await tx
        .update(s.settings)
        .set({ value: { staleDays: stallDays, approvalDays: 2, overdueDays: 1, ...retained } })
        .where(eq(s.settings.id, "health"));
    }
    await tx
      .insert(s.warehouses)
      .values([
        { id: "main", name: "Main Warehouse", shippingWeight: 100 },
        { id: "east", name: "East Depot", shippingWeight: 120 },
        { id: "west", name: "West Hub", shippingWeight: 140 },
      ])
      .onConflictDoNothing();
  });
  const users: { email: string; name: string; role: Role; customerId?: string }[] = [
    { email: "rep@dealflow360.demo", name: "Jordan Rao", role: "rep" },
    { email: "rep2@dealflow360.demo", name: "Alex Chen", role: "rep" },
    { email: "manager@dealflow360.demo", name: "Morgan Shah", role: "manager" },
    { email: "finance@dealflow360.demo", name: "Riley Iyer", role: "finance" },
    { email: "ops@dealflow360.demo", name: "Kai Patel", role: "ops" },
    { email: "admin@dealflow360.demo", name: "Demo Admin", role: "admin" },
    ...customerRows.map((c) => ({
      email: c.email,
      name: c.name,
      role: "customer" as const,
      customerId: c.id,
    })),
  ];
  let repId = "",
    managerId = "",
    financeId = "";
  for (const entry of users) {
    let [u] = await database.select().from(s.user).where(eq(s.user.email, entry.email));
    if (!u) {
      const result = await createAuth(database).api.signUpEmail({
        body: { email: entry.email, name: entry.name, password },
      });
      [u] = await database.select().from(s.user).where(eq(s.user.id, result.user.id));
    }
    await database
      .insert(s.profiles)
      .values({ userId: u!.id, role: entry.role, customerId: entry.customerId ?? null })
      .onConflictDoNothing();
    if (entry.role === "rep" && !repId) repId = u!.id;
    if (entry.role === "manager") managerId = u!.id;
    if (entry.role === "finance") financeId = u!.id;
  }
  await database.transaction(async (tx) => {
    const [existing] = await tx.select().from(s.quotes).where(eq(s.quotes.id, "Q-1042"));
    if (existing) return;
    const now = new Date();
    const ago = (days: number) => new Date(now.getTime() - days * 86400000);
    const quoteFixtures: {
      id: string;
      customerId: string;
      status: QuoteStatus;
      lines: { productId: string; quantity: number; discountBps: number }[];
      idle?: number;
    }[] = [
      {
        id: "Q-1042",
        customerId: "acme",
        status: "DRAFT",
        lines: [
          { productId: "laptop", quantity: 24, discountBps: 1200 },
          { productId: "setup", quantity: 1, discountBps: 1800 },
          { productId: "warranty", quantity: 1, discountBps: 1000 },
        ],
      },
      {
        id: "Q-1041",
        customerId: "acme",
        status: "APPROVED",
        lines: [
          { productId: "setup", quantity: 1, discountBps: 1800 },
          { productId: "care2", quantity: 1, discountBps: 0 },
        ],
      },
      {
        id: "Q-1039",
        customerId: "beta",
        status: "PENDING_APPROVAL",
        lines: [{ productId: "setup", quantity: 1, discountBps: 1800 }],
      },
      {
        id: "Q-1035",
        customerId: "nova",
        status: "APPROVED",
        lines: [{ productId: "mouse", quantity: 5, discountBps: 500 }],
      },
      {
        id: "Q-1030",
        customerId: "zenith",
        status: "SENT",
        idle: 9,
        lines: [{ productId: "setup", quantity: 2, discountBps: 500 }],
      },
      {
        id: "Q-1028",
        customerId: "delta",
        status: "UNDER_NEGOTIATION",
        lines: [{ productId: "setup", quantity: 1, discountBps: 2200 }],
      },
      {
        id: "Q-1026",
        customerId: "orion",
        status: "CONFIRMED",
        lines: [
          { productId: "setup", quantity: 2, discountBps: 0 },
          { productId: "care3", quantity: 1, discountBps: 0 },
        ],
      },
      {
        id: "Q-1024",
        customerId: "harbor",
        status: "CONFIRMED",
        lines: [
          { productId: "laptop", quantity: 50, discountBps: 500 },
          { productId: "monitoring", quantity: 1, discountBps: 0 },
        ],
      },
      {
        id: "Q-1022",
        customerId: "northwind",
        status: "CONFIRMED",
        lines: [{ productId: "laptop13", quantity: 8, discountBps: 500 }],
      },
      {
        id: "Q-1020",
        customerId: "beta",
        status: "RETURNED",
        lines: [{ productId: "setup", quantity: 1, discountBps: 1300 }],
      },
      {
        id: "Q-1018",
        customerId: "nova",
        status: "REJECTED",
        lines: [{ productId: "setup", quantity: 1, discountBps: 5000 }],
      },
      {
        id: "Q-1016",
        customerId: "acme",
        status: "DRAFT",
        lines: [{ productId: "mouse", quantity: 2, discountBps: 500 }],
      },
      ...[1, 2, 3].map((n) => ({
        id: `Q-H${n}`,
        customerId: "acme",
        status: "CONFIRMED" as const,
        lines: [{ productId: "setup", quantity: 1, discountBps: 800 }],
      })),
    ];
    for (const fixture of quoteFixtures) {
      const customer = customerRows.find((c) => c.id === fixture.customerId)!;
      const values = calculateQuote(
        priceLines(productRows, customer.tier, fixture.lines),
        0,
        customer.tier,
      );
      const approved = ["APPROVED", "SENT", "UNDER_NEGOTIATION", "CONFIRMED"].includes(
        fixture.status,
      );
      const [quote] = await tx
        .insert(s.quotes)
        .values({
          id: fixture.id,
          number: fixture.id,
          customerId: customer.id,
          ownerId: repId,
          ...values,
          status: fixture.status,
          revision: 1,
          approvedRevision: approved ? 1 : null,
          approvalStep: fixture.status === "PENDING_APPROVAL" ? "finance" : null,
          createdAt: ago(fixture.id.startsWith("Q-H") ? 30 : 12),
          updatedAt: ago(fixture.id.startsWith("Q-H") ? 30 : (fixture.idle ?? 1)),
          promisedDate: ago(fixture.status === "CONFIRMED" ? 2 : -7)
            .toISOString()
            .slice(0, 10),
        })
        .returning();
      if (fixture.status !== "DRAFT") {
        await tx.insert(s.quoteRevisions).values({
          id: crypto.randomUUID(),
          quoteId: fixture.id,
          revision: 1,
          lines: values.lines,
          riskSnapshot: values.riskSnapshot,
        });
        await tx.insert(s.auditEntries).values({
          id: crypto.randomUUID(),
          entityId: fixture.id,
          actorId: repId,
          actorName: "Jordan Rao",
          action: "QUOTE_SUBMITTED",
          reason: `Risk ${values.risk}`,
          revision: 1,
          detail: { risk: values.riskSnapshot },
          createdAt: ago(fixture.id.startsWith("Q-H") ? 30 : 12),
        });
        if (approved && values.risk === "NONE")
          await tx.insert(s.auditEntries).values({
            id: crypto.randomUUID(),
            entityId: fixture.id,
            actorId: null,
            actorName: "Automatic approval",
            action: "AUTO_APPROVED",
            reason: "All discounts are within policy",
            revision: 1,
            createdAt: ago(fixture.id.startsWith("Q-H") ? 30 : 12),
          });
        if ((approved || fixture.status === "PENDING_APPROVAL") && values.risk !== "NONE")
          await tx.insert(s.auditEntries).values({
            id: crypto.randomUUID(),
            entityId: fixture.id,
            actorId: managerId,
            actorName: "Morgan Shah",
            action: "APPROVAL_APPROVE",
            reason: "Commercial terms reviewed",
            revision: 1,
            createdAt: ago(11),
          });
        if (approved && values.risk === "HIGH")
          await tx.insert(s.auditEntries).values({
            id: crypto.randomUUID(),
            entityId: fixture.id,
            actorId: financeId,
            actorName: "Riley Iyer",
            action: "APPROVAL_APPROVE",
            reason: "Finance exception approved",
            revision: 1,
            createdAt: ago(10),
          });
        if (fixture.status === "RETURNED" || fixture.status === "REJECTED")
          await tx.insert(s.auditEntries).values({
            id: crypto.randomUUID(),
            entityId: fixture.id,
            actorId: managerId,
            actorName: "Morgan Shah",
            action: fixture.status === "RETURNED" ? "APPROVAL_RETURN" : "APPROVAL_REJECT",
            reason:
              fixture.status === "RETURNED"
                ? "Please provide a margin justification"
                : "The proposed discount is not justified",
            revision: 1,
            createdAt: ago(11),
          });
      }
      if (fixture.status === "CONFIRMED") {
        const [order] = await tx
          .insert(s.orders)
          .values({
            id: `order-${fixture.id}`,
            quoteId: fixture.id,
            number: fixture.id.replace("Q-", "SO-"),
            customerId: customer.id,
            lines: values.lines,
            createdAt: ago(10),
            promisedDate: quote!.promisedDate,
            fulfillmentStatus: ["Q-1024", "Q-1022"].includes(fixture.id)
              ? "BACKORDER"
              : "FULFILLED",
          })
          .returning();
        await createOrderBilling(tx, order!, ago(10));
        await tx
          .update(s.invoices)
          .set({ createdAt: ago(10) })
          .where(eq(s.invoices.orderId, order!.id));
        await tx
          .update(s.subscriptions)
          .set({ createdAt: ago(10) })
          .where(eq(s.subscriptions.orderId, order!.id));
      }
    }
    await tx
      .insert(s.stocks)
      .values([
        { id: "main-laptop", warehouseId: "main", productId: "laptop", onHand: 40, reserved: 18 },
        { id: "east-laptop", warehouseId: "east", productId: "laptop", onHand: 10, reserved: 6 },
        { id: "west-laptop", warehouseId: "west", productId: "laptop", onHand: 4, reserved: 0 },
        { id: "east-laptop13", warehouseId: "east", productId: "laptop13", onHand: 4, reserved: 4 },
        { id: "main-mouse", warehouseId: "main", productId: "mouse", onHand: 200, reserved: 0 },
        { id: "main-dock", warehouseId: "main", productId: "dock", onHand: 65, reserved: 0 },
        { id: "east-dock", warehouseId: "east", productId: "dock", onHand: 8, reserved: 0 },
        {
          id: "main-laptop16",
          warehouseId: "main",
          productId: "laptop16",
          onHand: 12,
          reserved: 0,
        },
      ])
      .onConflictDoNothing();
    await tx
      .insert(s.reservations)
      .values([
        {
          id: "harbor-main",
          orderId: "order-Q-1024",
          productId: "laptop",
          warehouseId: "main",
          quantity: 18,
        },
        {
          id: "harbor-east",
          orderId: "order-Q-1024",
          productId: "laptop",
          warehouseId: "east",
          quantity: 6,
        },
        {
          id: "northwind-east",
          orderId: "order-Q-1022",
          productId: "laptop13",
          warehouseId: "east",
          quantity: 4,
        },
      ])
      .onConflictDoNothing();
    const paid = await tx.select().from(s.invoices).where(eq(s.invoices.customerId, "orion"));
    for (const invoice of paid) {
      await tx.insert(s.payments).values({
        id: crypto.randomUUID(),
        invoiceId: invoice.id,
        operationKey: `seed-pay-${invoice.id}`,
        amountCents: invoice.totalCents,
        reference: "Demo bank transfer",
        actorId: financeId,
      });
      await tx
        .update(s.invoices)
        .set({ paidCents: invoice.totalCents, status: "PAID" })
        .where(eq(s.invoices.id, invoice.id));
    }
    await tx
      .insert(s.messages)
      .values({
        id: "seed-message",
        quoteId: "Q-1028",
        authorName: "Delta LLC",
        body: "Can we align the delivery date with our rollout?",
      })
      .onConflictDoNothing();
  });
}
