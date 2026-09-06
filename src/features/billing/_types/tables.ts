import type { Workspace } from "@/lib/domain/_types/workspace";
export type InvoiceRegisterRow = Workspace["invoices"][number] & {
  customerName: string;
  customerTier: string;
  orderNumber: string;
  outstandingCents: number;
  overdueDays: number;
};
export type InvoiceRow = Workspace["invoices"][number] & { customerName: string };
export type SubscriptionRow = Workspace["subscriptions"][number] & {
  customerName: string;
  orderNumber: string;
};
