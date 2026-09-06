export interface InvoiceDocument {
  creditedCents: number;
  customer: string;
  dueAt: string;
  issuedAt: string;
  kind: string;
  lines: { description: string; quantity: number; totalCents: number; unitPriceCents: number }[];
  number: string;
  paidCents: number;
  sourceNumber?: string;
  status: string;
  subtotalCents?: number;
  taxCents?: number;
  totalCents: number;
}

export interface ReportRow {
  category: string;
  customer: string;
  date: string;
  kind: string;
  number: string;
  outstandingCents: number;
  paidCents: number;
  status: string;
  totalCents: number;
}
