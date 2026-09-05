import { expect, test } from "bun:test";

import { approvalCycleMetrics } from "@/features/billing/approval-metrics";
import type { auditEntries } from "@/lib/db/schema/commerce";

function event(
  entityId: string,
  action: string,
  hour: number,
  revision: number | null = 1,
  detail: Record<string, unknown> = {},
): typeof auditEntries.$inferSelect {
  return {
    action,
    actorId: null,
    actorName: "Fixture",
    createdAt: new Date(Date.UTC(2026, 0, 1, hour)),
    detail,
    entityId,
    id: crypto.randomUUID(),
    reason: "",
    revision,
  };
}

test("approval timing includes both HIGH approval steps, auto approvals and no incomplete cycles", () => {
  const result = approvalCycleMetrics([
    event("high", "QUOTE_SUBMITTED", 0, 2, { risk: { risk: "HIGH" } }),
    event("high", "APPROVAL_APPROVE", 1, 2, { step: "manager" }),
    event("high", "APPROVAL_APPROVE", 3, 2, { step: "finance" }),
    event("medium", "QUOTE_SUBMITTED", 1, 1, { risk: { risk: "MEDIUM" } }),
    event("medium", "APPROVAL_APPROVE", 2, 1, { step: "manager" }),
    event("auto", "AUTO_APPROVED", 2),
    event("pending", "QUOTE_SUBMITTED", 0),
    event("returned", "QUOTE_SUBMITTED", 0),
    event("returned", "APPROVAL_RETURN", 1),
    event("legacy", "AUTO_APPROVED", 0, null),
    event("high", "APPROVAL_APPROVE", 4, 2, { step: "finance" }),
  ]);
  expect(result.completedApprovalCycles).toBe(3);
  expect(result.averageApprovalHours).toBeCloseTo(4 / 3, 8);
});

test("revisions cannot borrow another revision's submission and missing history is unknown", () => {
  expect(
    approvalCycleMetrics([
      event("quote", "QUOTE_SUBMITTED", 0, 1),
      event("quote", "APPROVAL_APPROVE", 3, 2, { step: "manager" }),
    ]),
  ).toEqual({ averageApprovalHours: null, completedApprovalCycles: 0 });
});
