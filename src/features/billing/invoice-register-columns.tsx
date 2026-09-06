import type { ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import type { DataTableFeatures } from "@/components/ui/_types/data-table";
import type { InvoiceRegisterRow } from "@/features/billing/_types/tables";
import { StatusMark } from "@/features/billing/invoice-editorial";
import { displayDate, displayStatus, money } from "@/features/shell/format";
import { cn } from "@/lib/utils";

/** Numbers are the primary visual element: right-aligned, tabular, comparable at a glance. */
function Numeric({ children, quiet = false }: { children: ReactNode; quiet?: boolean }) {
  return (
    <span
      className={cn(
        "block text-right tabular-nums",
        quiet ? "text-foreground/50" : "font-medium text-foreground",
      )}
    >
      {children}
    </span>
  );
}

function NumericHeader({ children }: { children: ReactNode }) {
  return <span className="block text-right">{children}</span>;
}

function stateOf(row: InvoiceRegisterRow) {
  if (row.outstandingCents === 0)
    return { label: displayStatus(row.status), tone: "settled" } as const;
  return row.overdueDays > 0
    ? ({ label: "Past due", tone: "flag" } as const)
    : ({ label: "Open", tone: "open" } as const);
}

export const invoiceRegisterColumns: ColumnDef<DataTableFeatures, InvoiceRegisterRow>[] = [
  {
    accessorKey: "number",
    cell: ({ row }) => (
      <span className="block">
        <span className="block font-medium text-foreground">{row.original.number}</span>
        <span className="mt-1 block text-xs text-foreground/45">{row.original.orderNumber}</span>
      </span>
    ),
    header: "Document",
  },
  {
    accessorKey: "customerName",
    cell: ({ row }) => (
      <span className="block">
        <span className="block text-foreground">{row.original.customerName}</span>
        <span className="mt-1 block text-xs text-foreground/45">{row.original.customerTier}</span>
      </span>
    ),
    header: "Customer",
  },
  {
    accessorKey: "kind",
    cell: ({ row }) => (
      <span className="text-foreground/70">{displayStatus(row.original.kind)}</span>
    ),
    header: "Stream",
  },
  {
    accessorKey: "dueDate",
    cell: ({ row }) => (
      <span className="block">
        <span className="block text-foreground/80 tabular-nums">
          {displayDate(row.original.dueDate)}
        </span>
        {row.original.overdueDays > 0 && (
          <span className="mt-1 block text-xs text-[var(--ink-flag)] tabular-nums">
            {row.original.overdueDays} days late
          </span>
        )}
      </span>
    ),
    header: "Due",
  },
  {
    accessorKey: "status",
    cell: ({ row }) => {
      const state = stateOf(row.original);
      return <StatusMark label={state.label} tone={state.tone} />;
    },
    header: "State",
  },
  {
    accessorKey: "totalCents",
    cell: ({ row }) => <Numeric quiet>{money(row.original.totalCents)}</Numeric>,
    header: () => <NumericHeader>Invoiced</NumericHeader>,
  },
  {
    accessorKey: "outstandingCents",
    cell: ({ row }) =>
      row.original.outstandingCents === 0 ? (
        <Numeric quiet>—</Numeric>
      ) : (
        <Numeric>{money(row.original.outstandingCents)}</Numeric>
      ),
    header: () => <NumericHeader>Outstanding</NumericHeader>,
  },
];
