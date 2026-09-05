import type { Actor, QuoteLine } from "@/lib/domain/_types/domain";
import type { Workspace } from "@/lib/domain/_types/workspace";

export interface PortalDetail {
  actor: Actor;
  customer: Workspace["customers"][number];
  messages: Workspace["messages"];
  quote: PublicQuote;
}

export interface PortalWorkspace {
  actor: Actor;
  customer: Workspace["customers"][number] | null;
  quotes: PublicQuote[];
}

export type PublicQuote = Pick<
  Workspace["quotes"][number],
  | "approvedRevision"
  | "customerId"
  | "id"
  | "number"
  | "orderDiscountBps"
  | "promisedDate"
  | "recurringCents"
  | "revision"
  | "status"
  | "subtotalCents"
  | "taxCents"
  | "totalCents"
  | "updatedAt"
> & { lines: Omit<QuoteLine, "costCents">[] };
