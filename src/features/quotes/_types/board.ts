import type { QuoteStatus } from "@/lib/domain/_types/domain";

/**
 * A Kanban board column groups one or more real {@link QuoteStatus} values.
 * Moving a card between columns maps to governed transitions, never a direct
 * status write. Terminal columns cannot be left.
 */
export interface BoardColumn {
  readonly id: BoardColumnId;
  readonly label: string;
  readonly statuses: readonly QuoteStatus[];
  readonly terminal: boolean;
}

export type BoardColumnId =
  | "draft"
  | "approval"
  | "approved"
  | "negotiation"
  | "confirmed"
  | "rejected";

export type BoardMoveAction = "submit" | "approve" | "return" | "reject" | "send";

/** The minimal shape of a quote the board needs to plan a move. */
export interface BoardQuote {
  approvalStep: string | null;
  id: string;
  revision: number;
  status: QuoteStatus;
}

export type MovePlan =
  | { ok: false; reason: string }
  | {
      /** Short label describing the action for toasts / announcements. */
      action: BoardMoveAction;
      body: Record<string, unknown>;
      ok: true;
      /** Status to show optimistically until the server responds. */
      optimisticStatus: QuoteStatus;
      /** POST path relative to `/api/v1`, e.g. `/quotes/<id>/submit`. */
      path: string;
      /** True when the move requires a human-entered decision reason. */
      requiresReason: boolean;
    };
