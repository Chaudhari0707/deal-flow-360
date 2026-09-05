import type { Workspace } from "@/lib/domain/_types/workspace";

export interface LineInput {
  discountBps: number;
  id?: string;
  productId: string;
  quantity: number;
  upsell?: boolean;
}

export interface PricingProduct {
  category: string;
  costCents: number;
  id: string;
  intervalMonths: number;
  name: string;
  pairedProductIds?: string[];
  priceCents: number;
  stockable: boolean;
  taxBps: number;
  variant: string;
}

export interface QuoteInput {
  customerId: string;
  lines: LineInput[];
  notes?: string;
  orderDiscountBps: number;
  promisedDate?: string;
  revision?: number;
}

export type QuoteRow = Workspace["quotes"][number] & { customerName: string };
