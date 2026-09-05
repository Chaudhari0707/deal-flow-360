"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { DataTableFeatures } from "@/components/ui/_types/data-table";
import { Badge } from "@/components/ui/badge";
import type { QuoteRow } from "@/features/quotes/_types/quotes";
import { money } from "@/features/quotes/rules";

export const quoteColumns: ColumnDef<DataTableFeatures, QuoteRow>[] = [
  {
    accessorKey: "number",
    header: "Quotation",
    cell: ({ row }) => <span className="font-medium">{row.original.number}</span>,
  },
  { accessorKey: "customerName", header: "Customer" },
  {
    accessorKey: "status",
    header: "Stage",
    cell: ({ row }) => (
      <Badge variant="secondary">{row.original.status.replaceAll("_", " ")}</Badge>
    ),
  },
  {
    accessorKey: "totalCents",
    header: "One-time value",
    cell: ({ row }) => money(row.original.totalCents),
  },
  {
    accessorKey: "risk",
    header: "Approval risk",
    cell: ({ row }) => (
      <Badge variant={row.original.risk === "HIGH" ? "destructive" : "outline"}>
        {row.original.risk}
      </Badge>
    ),
  },
  {
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ row }) =>
      new Date(row.original.updatedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
  },
];
