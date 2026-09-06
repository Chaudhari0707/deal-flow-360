export interface Actor {
  customerId: string | null;
  email: string;
  id: string;
  mustChangePassword?: boolean;
  name: string;
  role: Role;
}

export interface QuoteLine {
  category: string;
  costCents: number;
  discountBps: number;
  id: string;
  intervalMonths: number;
  name: string;
  netCents: number;
  priceCents: number;
  productId: string;
  quantity: number;
  stockable: boolean;
  taxBps: number;
  taxCents: number;
  totalCents: number;
  upsell?: boolean;
  variant: string;
}

export type QuoteStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "SENT"
  | "UNDER_NEGOTIATION"
  | "CONFIRMED"
  | "RETURNED"
  | "REJECTED";

export interface RiskSnapshot {
  lines: { ceilingBps: number; effectiveBps: number; name: string; overBps: number }[];
  maxOverBps: number;
  risk: "NONE" | "MEDIUM" | "HIGH";
  sumOverBps: number;
}

export type Role = "admin" | "customer" | "finance" | "manager" | "ops" | "rep";
