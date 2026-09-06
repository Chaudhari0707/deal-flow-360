import { t } from "elysia";

import { invoiceModel, paymentModel } from "@/server/models";

const reportRowModel = t.Object({
  category: t.String(),
  customer: t.String(),
  date: t.String({ format: "date-time" }),
  kind: t.String(),
  number: t.String(),
  outstandingCents: t.Integer(),
  paidCents: t.Integer(),
  status: t.String(),
  totalCents: t.Integer(),
});

const salesRecordModel = t.Object({
  amountCents: t.Integer(),
  customer: t.String(),
  date: t.String({ format: "date-time" }),
  id: t.String(),
  kind: t.Union([t.Literal("ORDER"), t.Literal("QUOTE")]),
  number: t.String(),
  representative: t.String(),
  status: t.String(),
  team: t.String(),
});

const salesReportModel = t.Object({
  metrics: t.Object({
    averageApprovalHours: t.Union([t.Number(), t.Null()]),
    completedApprovalCycles: t.Integer(),
    orderedCents: t.Integer(),
    ordersConfirmed: t.Integer(),
    quotesCreated: t.Integer(),
    topUpsoldProduct: t.Union([
      t.Object({ name: t.String(), productId: t.String(), quantity: t.Integer() }),
      t.Null(),
    ]),
  }),
  orders: t.Array(salesRecordModel),
  quotes: t.Array(salesRecordModel),
});

export const paymentResultModel = t.Object({ invoice: invoiceModel, payment: paymentModel });

export const applyCreditResultModel = t.Object({
  appliedCents: t.Integer(),
  invoice: invoiceModel,
});

export const billingRunModel = t.Object({
  checked: t.Integer(),
  issued: t.Integer(),
  moreMayRemain: t.Boolean(),
});

export const financialReportModel = t.Object({
  rows: t.Array(reportRowModel),
  totals: t.Object({
    billedCents: t.Integer(),
    outstandingCents: t.Integer(),
    paidCents: t.Integer(),
  }),
  sales: salesReportModel,
  options: t.Object({
    representatives: t.Array(t.Object({ id: t.String(), name: t.String() })),
    teams: t.Array(t.String()),
  }),
});

export const billingModels = {
  ApplyCreditResult: applyCreditResultModel,
  BillingRun: billingRunModel,
  FinancialReport: financialReportModel,
  PaymentResult: paymentResultModel,
} as const;
