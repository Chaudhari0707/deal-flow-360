import type { ColumnDef } from "@tanstack/react-table";

import type { DataTableFeatures } from "@/components/ui/_types/data-table";
import { Badge } from "@/components/ui/badge";
import type { ReportRow } from "@/features/billing/_types/documents";
import type { InvoiceRow, SubscriptionRow } from "@/features/billing/_types/tables";
import { invoiceOutstanding } from "@/features/billing/rules";
import { displayDate, displayStatus, money } from "@/features/shell/format";

export const invoiceColumns: ColumnDef<DataTableFeatures, InvoiceRow>[] = [
  { accessorKey: "number", header: "Invoice" },
  { accessorKey: "customerName", header: "Customer" },
  { accessorKey: "kind", cell: ({ row }) => displayStatus(row.original.kind), header: "Stream" },
  { accessorKey: "dueDate", cell: ({ row }) => displayDate(row.original.dueDate), header: "Due" },
  {
    accessorKey: "status",
    cell: ({ row }) => (
      <Badge variant={row.original.status === "PAID" ? "secondary" : "outline"}>
        {displayStatus(row.original.status)}
      </Badge>
    ),
    header: "Status",
  },
  {
    accessorFn: invoiceOutstanding,
    cell: ({ row }) => money(invoiceOutstanding(row.original)),
    header: "Outstanding",
    id: "outstanding",
  },
];

export const subscriptionColumns: ColumnDef<DataTableFeatures, SubscriptionRow>[] = [
  { accessorKey: "name", header: "Plan" },
  { accessorKey: "orderNumber", header: "Order" },
  { accessorKey: "customerName", header: "Customer" },
  { accessorKey: "quantity", header: "Quantity" },
  {
    accessorKey: "intervalMonths",
    cell: ({ row }) =>
      row.original.intervalMonths === 12
        ? "Yearly"
        : row.original.intervalMonths === 3
          ? "Quarterly"
          : "Monthly",
    header: "Cadence",
  },
  {
    accessorKey: "periodEnd",
    cell: ({ row }) =>
      row.original.status === "ACTIVE" ? displayDate(row.original.periodEnd) : "Cancelled",
    header: "Next billing",
  },
  {
    accessorKey: "status",
    cell: ({ row }) => (
      <Badge variant={row.original.status === "ACTIVE" ? "secondary" : "outline"}>
        {displayStatus(row.original.status)}
      </Badge>
    ),
    header: "Status",
  },
  {
    accessorKey: "periodNetCents",
    cell: ({ row }) => money(row.original.periodNetCents),
    header: "Period net",
  },
];

export const reportColumns: ColumnDef<DataTableFeatures, ReportRow>[] = [
  { accessorKey: "number", header: "Document" },
  { accessorKey: "date", cell: ({ row }) => displayDate(row.original.date), header: "Date" },
  { accessorKey: "customer", header: "Customer" },
  { accessorKey: "category", header: "Category" },
  {
    accessorKey: "status",
    cell: ({ row }) => displayStatus(row.original.status),
    header: "Status",
  },
  {
    accessorKey: "totalCents",
    cell: ({ row }) =>
      `${row.original.kind === "credit" ? "−" : ""}${money(row.original.totalCents)}`,
    header: "Amount",
  },
  {
    accessorKey: "outstandingCents",
    cell: ({ row }) => money(row.original.outstandingCents),
    header: "Outstanding",
  },
];
