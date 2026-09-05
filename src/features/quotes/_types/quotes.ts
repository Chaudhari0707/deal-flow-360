export interface LineInput {
  discountBps: number;
  id?: string;
  productId: string;
  quantity: number;
}

export interface PricingProduct {
  category: string;
  costCents: number;
  id: string;
  intervalMonths: number;
  name: string;
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
