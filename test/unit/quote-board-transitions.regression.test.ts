import { describe, expect, test } from "bun:test";

import type { BoardQuote } from "@/features/quotes/_types/board";
import {
  allowedTargetColumns,
  BOARD_COLUMNS,
  boardCardHint,
  columnForStatus,
  isTerminalStatus,
  planMove,
} from "@/features/quotes/board-transitions";
import type { QuoteStatus, Role } from "@/lib/domain/_types/domain";

function quote(overrides: Partial<BoardQuote> = {}): BoardQuote {
  return { approvalStep: null, id: "q1", revision: 3, status: "DRAFT", ...overrides };
}

const ALL_STATUSES: QuoteStatus[] = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "SENT",
  "UNDER_NEGOTIATION",
  "CONFIRMED",
  "RETURNED",
  "REJECTED",
];

const ALL_ROLES: Role[] = ["admin", "customer", "finance", "manager", "ops", "rep"];

describe("board column mapping", () => {
  test("every quote status maps to exactly one existing column", () => {
    for (const status of ALL_STATUSES) {
      const columnId = columnForStatus(status);
      const owning = BOARD_COLUMNS.filter((column) => column.statuses.includes(status));
      expect(owning).toHaveLength(1);
      expect(owning[0]!.id).toBe(columnId);
    }
  });

  test("only CONFIRMED and REJECTED are terminal", () => {
    const terminal = ALL_STATUSES.filter((status) => isTerminalStatus(status));
    expect(terminal.sort()).toEqual(["CONFIRMED", "REJECTED"]);
  });
});

describe("allowed transitions map to the governed workflow", () => {
  test("rep submits a draft for approval", () => {
    const plan = planMove(quote({ status: "DRAFT" }), "approval", "rep");
    expect(plan).toEqual({
      action: "submit",
      body: { revision: 3 },
      ok: true,
      optimisticStatus: "PENDING_APPROVAL",
      path: "/quotes/q1/submit",
      requiresReason: false,
    });
  });

  test("rep submits a returned quotation for approval", () => {
    const plan = planMove(quote({ status: "RETURNED" }), "approval", "rep");
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(plan.action).toBe("submit");
  });

  test("manager approves an in-approval quotation it owns, with a reason", () => {
    const plan = planMove(
      quote({ status: "PENDING_APPROVAL", approvalStep: "manager" }),
      "approved",
      "manager",
      "Discount is within the committed budget",
    );
    expect(plan).toMatchObject({
      action: "approve",
      body: {
        action: "approve",
        reason: "Discount is within the committed budget",
        revision: 3,
      },
      ok: true,
      optimisticStatus: "APPROVED",
      path: "/quotes/q1/approval",
      requiresReason: true,
    });
  });

  test("finance approves when it is the current approval step", () => {
    const plan = planMove(
      quote({ status: "PENDING_APPROVAL", approvalStep: "finance" }),
      "approved",
      "finance",
      "Margin acceptable",
    );
    expect(plan.ok).toBe(true);
  });

  test("approver returns an in-approval quotation to draft", () => {
    const plan = planMove(
      quote({ status: "PENDING_APPROVAL", approvalStep: "manager" }),
      "draft",
      "manager",
      "Please revisit the shipping line",
    );
    expect(plan).toMatchObject({ action: "return", ok: true, optimisticStatus: "RETURNED" });
  });

  test("approver rejects an in-approval quotation", () => {
    const plan = planMove(
      quote({ status: "PENDING_APPROVAL", approvalStep: "manager" }),
      "rejected",
      "manager",
      "Outside policy and non-negotiable",
    );
    expect(plan).toMatchObject({ action: "reject", ok: true, optimisticStatus: "REJECTED" });
  });

  test("an approved quotation is sent to the customer (moves to negotiation)", () => {
    const plan = planMove(quote({ status: "APPROVED" }), "negotiation", "rep");
    expect(plan).toEqual({
      action: "send",
      body: { renew: false },
      ok: true,
      optimisticStatus: "SENT",
      path: "/quotes/q1/send",
      requiresReason: false,
    });
  });
});

describe("terminal quotations can never move", () => {
  for (const status of ["CONFIRMED", "REJECTED"] as const) {
    test(`a ${status} quotation refuses every target for every role`, () => {
      for (const role of ALL_ROLES) {
        for (const column of BOARD_COLUMNS) {
          const plan = planMove(quote({ status }), column.id, role, "any reason here");
          expect(plan.ok).toBe(false);
        }
        expect(allowedTargetColumns(quote({ status }), role)).toEqual([]);
      }
    });
  }

  test("a completed order reports a clear, distinct message", () => {
    const confirmed = planMove(quote({ status: "CONFIRMED" }), "negotiation", "rep");
    expect(confirmed).toEqual({
      ok: false,
      reason: "This order is completed and can no longer change stage.",
    });
    const rejected = planMove(quote({ status: "REJECTED" }), "draft", "rep");
    expect(rejected).toEqual({
      ok: false,
      reason: "A rejected quotation is closed and cannot be moved.",
    });
  });
});

describe("forbidden moves are refused without a plan", () => {
  test("a non-rep cannot submit a draft", () => {
    for (const role of ["manager", "finance", "ops", "admin", "customer"] as Role[]) {
      expect(planMove(quote({ status: "DRAFT" }), "approval", role).ok).toBe(false);
    }
  });

  test("a rep cannot approve, return or reject an in-approval quotation", () => {
    for (const target of ["approved", "draft", "rejected"] as const) {
      expect(
        planMove(
          quote({ status: "PENDING_APPROVAL", approvalStep: "manager" }),
          target,
          "rep",
          "trying to force it",
        ).ok,
      ).toBe(false);
    }
  });

  test("the wrong approver cannot act while another step is pending", () => {
    const financeStep = planMove(
      quote({ status: "PENDING_APPROVAL", approvalStep: "finance" }),
      "approved",
      "manager",
      "not my turn",
    );
    expect(financeStep).toEqual({
      ok: false,
      reason: "Waiting on Finance to decide.",
    });
  });

  test("approval decisions require a reason of at least three characters", () => {
    const plan = planMove(
      quote({ status: "PENDING_APPROVAL", approvalStep: "manager" }),
      "approved",
      "manager",
      "no",
    );
    expect(plan).toEqual({
      ok: false,
      reason: "Add a decision reason (at least 3 characters).",
    });
  });

  test("dropping a card back into its own column is a no-op refusal", () => {
    expect(planMove(quote({ status: "DRAFT" }), "draft", "rep")).toEqual({
      ok: false,
      reason: "Already in this stage.",
    });
  });

  test("skipping a stage (draft straight to approved) is refused", () => {
    expect(planMove(quote({ status: "DRAFT" }), "approved", "rep").ok).toBe(false);
    expect(planMove(quote({ status: "DRAFT" }), "negotiation", "rep").ok).toBe(false);
  });
});

describe("allowedTargetColumns surfaces only legal drop targets", () => {
  test("a rep draft may only move into approval", () => {
    expect(allowedTargetColumns(quote({ status: "DRAFT" }), "rep")).toEqual(["approval"]);
  });

  test("a manager on a manager-step approval may approve, return or reject", () => {
    expect(
      allowedTargetColumns(
        quote({ status: "PENDING_APPROVAL", approvalStep: "manager" }),
        "manager",
      ).sort(),
    ).toEqual(["approved", "draft", "rejected"]);
  });

  test("an approved quotation may only move into negotiation for a rep", () => {
    expect(allowedTargetColumns(quote({ status: "APPROVED" }), "rep")).toEqual(["negotiation"]);
  });

  test("ops has no board actions on any active quotation", () => {
    for (const status of ["DRAFT", "PENDING_APPROVAL", "APPROVED"] as QuoteStatus[]) {
      expect(allowedTargetColumns(quote({ status, approvalStep: "manager" }), "ops")).toEqual([]);
    }
  });
});

describe("board card hints keep a reason when Move is unavailable", () => {
  test("negotiation waits on the customer instead of hiding the card action", () => {
    expect(boardCardHint(quote({ status: "SENT" }), "rep")).toBe("Waiting on customer");
    expect(boardCardHint(quote({ status: "UNDER_NEGOTIATION" }), "rep")).toBe(
      "Waiting on customer",
    );
  });

  test("ops sees an explicit no-action hint rather than an empty footer", () => {
    expect(boardCardHint(quote({ status: "DRAFT" }), "ops")).toBe("No board action for your role");
  });
});
