export interface ReportFilters {
  approvalStatus?: "APPROVED" | "NOT_SUBMITTED" | "PENDING" | "REJECTED" | "RETURNED";
  category?: string;
  customerId?: string;
  from?: string;
  productId?: string;
  repId?: string;
  status?: string;
  team?: string;
  to?: string;
}

export interface ReportOptions {
  representatives: { id: string; name: string }[];
  teams: string[];
}

export interface SalesRecord {
  amountCents: number;
  customer: string;
  date: string;
  id: string;
  kind: "ORDER" | "QUOTE";
  number: string;
  representative: string;
  status: string;
  team: string;
}

export interface SalesReport {
  metrics: {
    averageApprovalHours: number | null;
    completedApprovalCycles: number;
    orderedCents: number;
    ordersConfirmed: number;
    quotesCreated: number;
    topUpsoldProduct: { name: string; productId: string; quantity: number } | null;
  };
  orders: SalesRecord[];
  quotes: SalesRecord[];
}
