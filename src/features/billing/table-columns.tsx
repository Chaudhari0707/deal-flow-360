import type { ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import type { DataTableClassNames, DataTableFeatures } from "@/components/ui/_types/data-table";
import type { ReportRow } from "@/features/billing/_types/documents";
import type { SalesRecord } from "@/features/billing/_types/reports";
import type { InvoiceRow, SubscriptionRow } from "@/features/billing/_types/tables";
import { StatusMark } from "@/features/billing/invoice-editorial";
import { invoiceOutstanding } from "@/features/billing/rules";
import { displayDate, displayStatus, money } from "@/features/shell/format";
import { cn } from "@/lib/utils";

/**
 * Editorial chrome for the billing registers. The ported table primitive already supplies the
 * letterspaced header rule and the hairline row rhythm, so only the slots it cannot know about
 * are set here: the outer box is removed and columns are separated by a gutter rather than by
 * cell padding, which keeps the first column flush with the page measure.
 */
export const billingTableStyles: DataTableClassNames = {
  cell: "px-0 pr-8 last:pr-0",
  container: "rounded-none border-0",
  emptyCell: "px-0 text-muted-foreground",
  head: "px-0 pr-8 last:pr-0",
  table: "text-[0.8125rem]",
};

/** Numbers are the primary visual element: right-aligned, tabular, comparable down the column. */
function Numeric({ children, quiet = false }: { children: ReactNode; quiet?: boolean }) {
  return (
    <span
      className={cn(
        "block text-right tabular-nums",
        quiet ? "text-muted-foreground" : "font-medium text-foreground",
      )}
    >
      {children}
    </span>
  );
}

function NumericHeader({ children }: { children: ReactNode }) {
  return <span className="block text-right">{children}</span>;
}

/** The document identifier carries the row; supporting fields recede to the quiet ink. */
function Identifier({ children }: { children: ReactNode }) {
  return <span className="font-medium text-foreground">{children}</span>;
}

function Quiet({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}

export const invoiceColumns: ColumnDef<DataTableFeatures, InvoiceRow>[] = [
  {
    accessorKey: "number",
    cell: ({ row }) => <Identifier>{row.original.number}</Identifier>,
    header: "Invoice",
  },
  { accessorKey: "customerName", header: "Customer" },
  {
    accessorKey: "kind",
    cell: ({ row }) => <Quiet>{displayStatus(row.original.kind)}</Quiet>,
    header: "Stream",
  },
  {
    accessorKey: "dueDate",
    cell: ({ row }) => <span className="tabular-nums">{displayDate(row.original.dueDate)}</span>,
    header: "Due",
  },
  {
    accessorKey: "status",
    cell: ({ row }) => (
      <StatusMark
        label={displayStatus(row.original.status)}
        tone={row.original.status === "PAID" ? "settled" : "open"}
      />
    ),
    header: "Status",
  },
  {
    accessorFn: invoiceOutstanding,
    cell: ({ row }) => <Numeric>{money(invoiceOutstanding(row.original))}</Numeric>,
    header: () => <NumericHeader>Outstanding</NumericHeader>,
    id: "outstanding",
  },
];

export const subscriptionColumns: ColumnDef<DataTableFeatures, SubscriptionRow>[] = [
  {
    accessorKey: "name",
    cell: ({ row }) => <Identifier>{row.original.name}</Identifier>,
    header: "Plan",
  },
  {
    accessorKey: "orderNumber",
    cell: ({ row }) => <Quiet>{row.original.orderNumber}</Quiet>,
    header: "Order",
  },
  { accessorKey: "customerName", header: "Customer" },
  {
    accessorKey: "createdAt",
    cell: ({ row }) => <span className="tabular-nums">{displayDate(row.original.createdAt)}</span>,
    header: "Started",
  },
  {
    accessorKey: "quantity",
    cell: ({ row }) => <Numeric quiet>{row.original.quantity}</Numeric>,
    header: () => <NumericHeader>Quantity</NumericHeader>,
  },
  {
    accessorKey: "intervalMonths",
    cell: ({ row }) => (
      <Quiet>
        {row.original.intervalMonths === 12
          ? "Yearly"
          : row.original.intervalMonths === 3
            ? "Quarterly"
            : "Monthly"}
      </Quiet>
    ),
    header: "Cadence",
  },
  {
    accessorKey: "periodEnd",
    cell: ({ row }) =>
      row.original.status === "ACTIVE" ? (
        <span className="tabular-nums">{displayDate(row.original.periodEnd)}</span>
      ) : (
        <Quiet>Cancelled</Quiet>
      ),
    header: "Next billing",
  },
  {
    accessorKey: "status",
    cell: ({ row }) => (
      <StatusMark
        label={displayStatus(row.original.status)}
        tone={row.original.status === "ACTIVE" ? "settled" : "open"}
      />
    ),
    header: "Status",
  },
  {
    accessorKey: "periodNetCents",
    cell: ({ row }) => <Numeric>{money(row.original.periodNetCents)}</Numeric>,
    header: () => <NumericHeader>Period net</NumericHeader>,
  },
];

export const reportColumns: ColumnDef<DataTableFeatures, ReportRow>[] = [
  {
    accessorKey: "number",
    cell: ({ row }) => <Identifier>{row.original.number}</Identifier>,
    header: "Document",
  },
  {
    accessorKey: "date",
    cell: ({ row }) => <span className="tabular-nums">{displayDate(row.original.date)}</span>,
    header: "Date",
  },
  { accessorKey: "customer", header: "Customer" },
  {
    accessorKey: "category",
    cell: ({ row }) => <Quiet>{row.original.category}</Quiet>,
    header: "Category",
  },
  {
    accessorKey: "status",
    cell: ({ row }) => <Quiet>{displayStatus(row.original.status)}</Quiet>,
    header: "Status",
  },
  {
    accessorKey: "totalCents",
    cell: ({ row }) => (
      <Numeric quiet>
        {`${row.original.kind === "credit" ? "−" : ""}${money(row.original.totalCents)}`}
      </Numeric>
    ),
    header: () => <NumericHeader>Amount</NumericHeader>,
  },
  {
    accessorKey: "outstandingCents",
    cell: ({ row }) => <Numeric>{money(row.original.outstandingCents)}</Numeric>,
    header: () => <NumericHeader>Outstanding</NumericHeader>,
  },
];

export const salesColumns: ColumnDef<DataTableFeatures, SalesRecord>[] = [
  {
    accessorKey: "number",
    cell: ({ row }) => <Identifier>{row.original.number}</Identifier>,
    header: "Number",
  },
  {
    accessorKey: "kind",
    cell: ({ row }) => <Quiet>{row.original.kind}</Quiet>,
    header: "Record",
  },
  {
    accessorKey: "date",
    cell: ({ row }) => <span className="tabular-nums">{displayDate(row.original.date)}</span>,
    header: "Created",
  },
  { accessorKey: "customer", header: "Customer" },
  { accessorKey: "representative", header: "Representative" },
  {
    accessorKey: "team",
    cell: ({ row }) => <Quiet>{row.original.team}</Quiet>,
    header: "Team",
  },
  {
    accessorKey: "status",
    cell: ({ row }) => <Quiet>{displayStatus(row.original.status)}</Quiet>,
    header: "Status",
  },
  {
    accessorKey: "amountCents",
    cell: ({ row }) => <Numeric>{money(row.original.amountCents)}</Numeric>,
    header: () => <NumericHeader>Amount</NumericHeader>,
  },
];
