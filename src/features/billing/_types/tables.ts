import type { Workspace } from "@/lib/domain/_types/workspace";
export type InvoiceRow = Workspace["invoices"][number] & { customerName: string };
export type SubscriptionRow = Workspace["subscriptions"][number] & {
  customerName: string;
  orderNumber: string;
};
