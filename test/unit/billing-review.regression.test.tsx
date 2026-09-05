import { describe, expect, test } from "bun:test";

import { renderToStaticMarkup } from "react-dom/server";

import { ReportExportActions } from "@/features/billing/report-export-actions";
import { subscriptionPreview } from "@/features/billing/subscription-preview";
import type { Workspace } from "@/lib/domain/_types/workspace";

const subscription: Workspace["subscriptions"][number] = {
  anchorDay: 1,
  createdAt: "2026-04-01",
  customerId: "customer",
  id: "subscription",
  intervalMonths: 1,
  name: "Monthly service",
  orderId: "order",
  periodEnd: "2026-05-01",
  periodNetCents: 4600,
  periodStart: "2026-04-01",
  priceBasisCents: 4600,
  priceBasisQuantity: 1,
  priceCents: 4600,
  productId: "product",
  quantity: 1,
  status: "ACTIVE",
  taxBps: 0,
  version: 1,
};
const product: Workspace["products"][number] = {
  active: true,
  category: "Subscription",
  costCents: 1000,
  description: "Service",
  id: "product",
  intervalMonths: 1,
  name: "Monthly service",
  pairedProductIds: [],
  priceCents: 4600,
  promoted: false,
  promotionBps: 0,
  stockable: false,
  taxBps: 0,
  unit: "unit",
  variant: "Monthly",
};
const now = new Date("2026-04-16");

describe("CodeRabbit billing regressions", () => {
  test("unavailable exports are disabled native buttons with no navigable href", () => {
    const unavailable = renderToStaticMarkup(
      <ReportExportActions
        enabled={false}
        url="/api/v1/reports/financial?from=2026-09-02&to=2026-09-01"
      />,
    );
    expect(unavailable).not.toContain("href=");
    expect(unavailable.match(/<button /g)).toHaveLength(2);
    expect(unavailable.match(/ disabled=/g)).toHaveLength(2);
    const available = renderToStaticMarkup(
      <ReportExportActions enabled url="/api/v1/reports/financial?category=Service" />,
    );
    expect(available).toContain('href="/api/v1/reports/financial?category=Service&amp;format=pdf"');
    expect(available).toContain(
      'href="/api/v1/reports/financial?category=Service&amp;format=xlsx"',
    );
  });
  test("future-start and invalid-price subscriptions cannot crash preview or enable mutation", () => {
    expect(
      subscriptionPreview(
        { ...subscription, periodStart: "2026-05-01", periodEnd: "2026-06-01" },
        product,
        2,
        now,
      ),
    ).toEqual({ adjustment: null, valid: false });
    for (const denominator of [0, -1, 1.5, Number.NaN])
      expect(
        subscriptionPreview({ ...subscription, priceBasisQuantity: denominator }, product, 2, now),
      ).toEqual({ adjustment: null, valid: false });
    expect(
      subscriptionPreview(
        { ...subscription, priceBasisCents: Number.MAX_SAFE_INTEGER },
        product,
        10000,
        now,
      ),
    ).toEqual({ adjustment: null, valid: false });
    expect(subscriptionPreview(subscription, product, 10001, now)).toEqual({
      adjustment: null,
      valid: false,
    });
    expect(
      subscriptionPreview({ ...subscription, periodStart: "bad-date" }, product, 2, now),
    ).toEqual({ adjustment: null, valid: false });
  });
  test("valid current preview keeps exact cents and due periods retain server catch-up", () => {
    expect(
      subscriptionPreview(
        subscription,
        { ...product, active: false, taxBps: 1500, priceCents: 10000 },
        2,
        now,
      ),
    ).toEqual({ adjustment: 2300, valid: true });
    expect(subscriptionPreview(subscription, product, 2, now)).toEqual({
      adjustment: 2300,
      valid: true,
    });
    expect(subscriptionPreview(subscription, product, 2, new Date("2026-05-02"))).toEqual({
      adjustment: null,
      valid: true,
    });
  });
});
