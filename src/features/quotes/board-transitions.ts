import type {
  BoardColumn,
  BoardColumnId,
  BoardQuote,
  MovePlan,
} from "@/features/quotes/_types/board";
import type { QuoteStatus, Role } from "@/lib/domain/_types/domain";

/**
 * Kanban board columns for the quotation pipeline.
 *
 * The board is a view over the governed quote workflow, so a column groups one
 * or more real {@link QuoteStatus} values. Moving a card between columns never
 * writes a status directly; it maps to the existing domain transition endpoints
 * (submit / approval / send). Terminal columns cannot be left.
 */
export const BOARD_COLUMNS: readonly BoardColumn[] = [
  { id: "draft", label: "Draft", statuses: ["DRAFT", "RETURNED"], terminal: false },
  { id: "approval", label: "In approval", statuses: ["PENDING_APPROVAL"], terminal: false },
  { id: "approved", label: "Approved", statuses: ["APPROVED"], terminal: false },
  {
    id: "negotiation",
    label: "Negotiation",
    statuses: ["SENT", "UNDER_NEGOTIATION"],
    terminal: false,
  },
  { id: "confirmed", label: "Confirmed", statuses: ["CONFIRMED"], terminal: true },
  { id: "rejected", label: "Rejected", statuses: ["REJECTED"], terminal: true },
] as const;

const COLUMN_BY_ID = new Map(BOARD_COLUMNS.map((column) => [column.id, column]));

/** The board column that currently owns a quote status. */
export function columnForStatus(status: QuoteStatus): BoardColumnId {
  const match = BOARD_COLUMNS.find((column) => column.statuses.includes(status));
  // Every QuoteStatus is mapped above; fall back defensively to draft.
  return match?.id ?? "draft";
}

/** Terminal statuses can never move. Kept as a named guard for callers/tests. */
export function isTerminalStatus(status: QuoteStatus): boolean {
  return COLUMN_BY_ID.get(columnForStatus(status))?.terminal ?? false;
}

/**
 * Decide what (if anything) a board move should do.
 *
 * Pure and side-effect free so it can be unit tested for every role and
 * status combination. Returns `{ ok: false }` with a user-facing reason for
 * any move that the workflow or the actor's role does not permit.
 *
 * @param reason Optional decision reason. Only consumed by approval actions.
 */
export function planMove(
  quote: BoardQuote,
  targetColumnId: BoardColumnId,
  role: Role,
  reason?: string,
): MovePlan {
  const target = COLUMN_BY_ID.get(targetColumnId);
  if (!target) return { ok: false, reason: "Unknown board column." };

  const fromColumnId = columnForStatus(quote.status);
  if (fromColumnId === targetColumnId) return { ok: false, reason: "Already in this stage." };

  // Terminal quotes (order confirmed or rejected) can never be moved.
  if (isTerminalStatus(quote.status)) {
    return {
      ok: false,
      reason:
        quote.status === "CONFIRMED"
          ? "This order is completed and can no longer change stage."
          : "A rejected quotation is closed and cannot be moved.",
    };
  }

  const trimmedReason = reason?.trim() ?? "";

  // Draft / Returned -> In approval: the representative submits for approval.
  if (fromColumnId === "draft" && targetColumnId === "approval") {
    if (role !== "rep") return { ok: false, reason: "Only a sales rep can submit for approval." };
    return {
      ok: true,
      action: "submit",
      path: `/quotes/${quote.id}/submit`,
      body: { revision: quote.revision },
      optimisticStatus: "PENDING_APPROVAL",
      requiresReason: false,
    };
  }

  // In approval -> Approved / Draft / Rejected: the current approver decides.
  if (fromColumnId === "approval") {
    if (role !== "manager" && role !== "finance")
      return { ok: false, reason: "Only the assigned approver can decide this quotation." };
    if (quote.approvalStep && role !== quote.approvalStep)
      return {
        ok: false,
        reason: `Waiting on ${quote.approvalStep === "finance" ? "Finance" : "the Sales Manager"} to decide.`,
      };
    const action =
      targetColumnId === "approved"
        ? "approve"
        : targetColumnId === "draft"
          ? "return"
          : targetColumnId === "rejected"
            ? "reject"
            : null;
    if (!action)
      return { ok: false, reason: "Move an in-approval quotation to Approved, Draft or Rejected." };
    if (trimmedReason.length < 3)
      return { ok: false, reason: "Add a decision reason (at least 3 characters)." };
    return {
      ok: true,
      action,
      path: `/quotes/${quote.id}/approval`,
      body: { revision: quote.revision, action, reason: trimmedReason },
      // Approve may still route to a second approver (HIGH risk); the server
      // response is authoritative and revalidation reconciles the real status.
      optimisticStatus:
        action === "approve" ? "APPROVED" : action === "return" ? "RETURNED" : "REJECTED",
      requiresReason: true,
    };
  }

  // Approved -> Negotiation: send the quotation to the customer.
  if (fromColumnId === "approved" && targetColumnId === "negotiation") {
    if (role !== "rep" && role !== "manager" && role !== "finance")
      return { ok: false, reason: "Your role cannot send this quotation." };
    return {
      ok: true,
      action: "send",
      path: `/quotes/${quote.id}/send`,
      body: { renew: false },
      optimisticStatus: "SENT",
      requiresReason: false,
    };
  }

  return { ok: false, reason: "That stage change is not part of the quotation workflow." };
}

/** Column ids a quote may legally be dropped into, for enabling drop targets. */
export function allowedTargetColumns(quote: BoardQuote, role: Role): BoardColumnId[] {
  return BOARD_COLUMNS.filter(
    (column) => planMove(quote, column.id, role, "reason placeholder").ok,
  ).map((column) => column.id);
}

/** Short card footer when Move is not available, so the control does not vanish. */
export function boardCardHint(quote: BoardQuote, role: Role): string | null {
  if (quote.status === "CONFIRMED") return "Order completed";
  if (quote.status === "REJECTED") return "Closed";
  if (quote.status === "SENT" || quote.status === "UNDER_NEGOTIATION") return "Waiting on customer";
  if (quote.status === "PENDING_APPROVAL" && quote.approvalStep && role !== quote.approvalStep)
    return `Waiting on ${quote.approvalStep === "finance" ? "Finance" : "Sales Manager"}`;
  if (allowedTargetColumns(quote, role).length === 0) return "No board action for your role";
  return null;
}
