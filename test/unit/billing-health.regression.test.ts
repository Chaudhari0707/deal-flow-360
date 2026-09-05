import { describe, expect, test } from "bun:test";

import { dealHealth } from "@/features/billing/health";
import type { Workspace } from "@/lib/domain/_types/workspace";

function workspace(): Workspace {
  return {
    activity: [],
    actor: {
      customerId: null,
      email: "finance@example.com",
      id: "finance",
      name: "Finance",
      role: "finance",
    },
    credits: [],
    customers: [
      {
        email: "customer@example.com",
        id: "customer",
        name: "Fixture customer",
        team: "Enterprise",
        tier: "Bronze",
      },
    ],
    deliveries: [],
    invoices: [],
    messages: [],
    orders: [],
    payments: [],
    products: [],
    quotes: [],
    reservations: [],
    settings: [],
    stocks: [],
    subscriptions: [],
    warehouses: [],
  };
}

function quote(id: string, discountBps: number, ownerId = "rep"): Workspace["quotes"][number] {
  return {
    approvalStep: null,
    approvedRevision: 1,
    createdAt: "2026-09-01",
    customerId: "customer",
    id,
    lines: [
      {
        category: "Services",
        costCents: 0,
        discountBps,
        id: `line-${id}`,
        intervalMonths: 0,
        name: "Service",
        netCents: 100,
        priceCents: 100,
        productId: "service",
        quantity: 1,
        stockable: false,
        taxBps: 0,
        taxCents: 0,
        totalCents: 100,
        variant: "Standard",
      },
    ],
    marginCents: 0,
    notes: "",
    number: id,
    orderDiscountBps: 0,
    ownerId,
    promisedDate: null,
    recurringCents: 0,
    revision: 1,
    risk: "NONE",
    riskSnapshot: null,
    status: "CONFIRMED",
    subtotalCents: 100,
    taxCents: 0,
    totalCents: 100,
    updatedAt: "2026-09-01",
  };
}

describe("health signals respect commercial facts", () => {
  test("discount anomaly compares the same representative's confirmed history and requires three samples", () => {
    const data = workspace();
    data.quotes = [
      quote("history1", 800),
      quote("history2", 800),
      quote("history3", 800),
      { ...quote("Delta", 2200), status: "UNDER_NEGOTIATION" },
    ];
    const anomaly = dealHealth(data, new Date("2026-09-05")).items.find(
      (item) => item.id === "anomaly:Delta",
    );
    expect(anomaly?.detail).toContain("22.0%");
    expect(anomaly?.detail).toContain("8.0%");
    expect(anomaly?.href).toBe("/quotations/Delta");
    data.quotes[0]!.ownerId = "other-rep";
    expect(
      dealHealth(data, new Date("2026-09-05")).items.some((item) => item.id === "anomaly:Delta"),
    ).toBe(false);
    data.quotes[0]!.ownerId = "rep";
    data.quotes[0]!.updatedAt = "2025-01-01";
    expect(
      dealHealth(data, new Date("2026-09-05")).items.some((item) => item.id === "anomaly:Delta"),
    ).toBe(false);
  });
  test("fulfilled orders never produce a false delivery warning", () => {
    const data = workspace();
    data.orders = [
      {
        acceptedAt: "2026-09-01",
        createdAt: "2026-09-01",
        customerId: "customer",
        fulfillmentStatus: "FULFILLED",
        id: "order",
        lines: [],
        number: "SO-1",
        promisedDate: "2026-09-01",
        quoteId: "quote",
      },
    ];
    expect(dealHealth(data, new Date("2026-09-05")).items).toHaveLength(0);
    data.orders[0]!.fulfillmentStatus = "BACKORDER";
    expect(dealHealth(data, new Date("2026-09-05")).items[0]?.href).toBe("/fulfillment/order");
  });
  test("an overdue unpaid invoice signals collection without claiming shipment delay", () => {
    const data = workspace();
    data.invoices = [
      {
        createdAt: "2026-09-01",
        creditedCents: 0,
        customerId: "customer",
        dueDate: "2026-09-03",
        id: "invoice",
        kind: "ONE_TIME",
        lines: [],
        number: "INV-1",
        operationKey: "invoice-key",
        orderId: "order",
        paidCents: 0,
        periodEnd: null,
        periodStart: null,
        status: "UNPAID",
        subscriptionId: null,
        subtotalCents: 4600,
        taxCents: 0,
        totalCents: 4600,
      },
    ];
    const result = dealHealth(data, new Date("2026-09-05"));
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.title).toBe("INV-1: payment overdue");
    expect(result.items[0]?.detail).toContain("does not indicate shipment delay");
    data.settings = [{ id: "health", value: { overdueDays: 3 } }];
    expect(dealHealth(data, new Date("2026-09-05")).items).toHaveLength(0);
    expect(dealHealth(data, new Date("2026-09-06")).items).toHaveLength(1);
    data.invoices[0]!.paidCents = 4600;
    expect(dealHealth(data, new Date("2026-09-05")).items).toHaveLength(0);
  });
});
