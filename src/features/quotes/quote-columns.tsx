"use client";

import type { ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import type { DataTableFeatures } from "@/components/ui/_types/data-table";
import type { QuoteRow } from "@/features/quotes/_types/quotes";
import { money } from "@/features/quotes/rules";
import { cn } from "@/lib/utils";

/**
 * Approval risk reads as a square marker plus text in an AAA ink — never a coloured pill.
 * Only real risk earns colour; a compliant quotation stays quiet, and every row keeps the
 * same text start so a column of markers reads as one aligned edge.
 */
const riskMark = {
  HIGH: "bg-ink-risk",
  MEDIUM: "bg-foreground/45",
  NONE: "bg-foreground/25",
} as const;

const riskInk = {
  HIGH: "text-ink-risk",
  MEDIUM: "text-foreground",
  NONE: "text-muted-foreground",
} as const;

/** Shared with the board so a quotation's risk looks identical in both views. */
export function RiskMark({ label, risk }: { label: string; risk: QuoteRow["risk"] }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span aria-hidden className={cn("size-1.5 shrink-0", riskMark[risk])} />
      <span className={riskInk[risk]}>{label}</span>
    </span>
  );
}

/** Money is the primary visual element: right aligned under a right-aligned label, tabular. */
function NumericHeader({ children }: { children: ReactNode }) {
  return <span className="block text-right">{children}</span>;
}

export const quoteColumns: ColumnDef<DataTableFeatures, QuoteRow>[] = [
  {
    accessorKey: "number",
    header: "Quotation",
    cell: ({ row }) => <span className="font-medium text-foreground">{row.original.number}</span>,
  },
  {
    accessorKey: "customerName",
    header: "Customer",
    cell: ({ row }) => <span className="text-foreground">{row.original.customerName}</span>,
  },
  {
    accessorKey: "status",
    header: "Stage",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.status.replaceAll("_", " ")}</span>
    ),
  },
  {
    accessorKey: "totalCents",
    header: () => <NumericHeader>One-time value</NumericHeader>,
    cell: ({ row }) => (
      <span className="block text-right font-medium text-foreground tabular-nums">
        {money(row.original.totalCents)}
      </span>
    ),
  },
  {
    accessorKey: "risk",
    header: "Approval risk",
    cell: ({ row }) => <RiskMark label={row.original.risk} risk={row.original.risk} />,
  },
  {
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ row }) => (
      <span className="text-muted-foreground tabular-nums">
        {new Date(row.original.updatedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}
      </span>
    ),
  },
];
