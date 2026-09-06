"use client";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import type { InvoiceRegisterRow } from "@/features/billing/_types/tables";
import { SectionHead } from "@/features/billing/invoice-editorial";
import { invoiceRegisterColumns } from "@/features/billing/invoice-register-columns";
import { money } from "@/features/shell/format";
import { cn } from "@/lib/utils";

const lenses = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "overdue", label: "Past due" },
  { id: "settled", label: "Settled" },
] as const;

/**
 * The shared DataTable keeps sorting, pagination and keyboard-accessible rows; every piece of
 * its default chrome is replaced with editorial rules, alignment and letterspaced labels.
 */
const registerStyles = {
  cell: "border-b border-foreground/10 px-0 py-4 pr-8 align-top last:pr-0",
  container: "rounded-none border-0",
  head: "h-auto border-b border-foreground/30 px-0 pt-0 pr-8 pb-3 text-[0.6875rem] font-medium tracking-[0.16em] text-foreground/45 uppercase last:pr-0",
  pagination: cn(
    "mt-7 border-t border-foreground/15 px-0 pt-4",
    "[&_[data-slot=button]]:rounded-none [&_[data-slot=button]]:border-foreground/20 [&_[data-slot=button]]:bg-transparent",
    "[&_[data-slot=select-trigger]]:rounded-none [&_[data-slot=select-trigger]]:border-foreground/20 [&_[data-slot=select-trigger]]:bg-transparent",
    "[&_p]:text-[0.6875rem] [&_p]:font-medium [&_p]:tracking-[0.16em] [&_p]:text-foreground/50 [&_p]:uppercase",
  ),
  row: "border-0 hover:bg-foreground/[0.035] data-[state=selected]:bg-transparent",
  table: "text-[0.8125rem]",
};

export function InvoiceRegister({
  onSelect,
  rows,
}: {
  onSelect: (id: string) => void;
  rows: InvoiceRegisterRow[];
}) {
  const [lens, setLens] = useState<(typeof lenses)[number]["id"]>("all");
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const visible = rows.filter((row) => {
    if (lens === "open" && row.outstandingCents === 0) return false;
    if (lens === "overdue" && row.overdueDays === 0) return false;
    if (lens === "settled" && row.outstandingCents > 0) return false;
    if (!term) return true;
    return `${row.number} ${row.customerName} ${row.orderNumber}`.toLowerCase().includes(term);
  });
  const outstanding = visible.reduce((sum, row) => sum + row.outstandingCents, 0);
  return (
    <section className="mt-14">
      <SectionHead index="01" title="Invoice register">
        <span className="tabular-nums">
          {visible.length} of {rows.length} documents
        </span>
        <span aria-hidden>·</span>
        <span className="tabular-nums">{money(outstanding)} outstanding in view</span>
      </SectionHead>
      <div className="flex flex-col gap-5 py-6 md:flex-row md:items-end md:justify-between md:gap-10">
        <Input
          type="search"
          aria-label="Search invoices"
          placeholder="Search invoice or customer"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-9 w-full max-w-sm rounded-none border-0 border-b-2 border-foreground/20 bg-transparent px-0 text-sm placeholder:text-foreground/40 focus-visible:border-foreground focus-visible:ring-0 dark:bg-transparent"
        />
        <div className="flex flex-wrap items-center gap-x-7 gap-y-2">
          {lenses.map((entry) => (
            <Button
              key={entry.id}
              type="button"
              variant="ghost"
              aria-pressed={lens === entry.id}
              onClick={() => setLens(entry.id)}
              className={cn(
                "relative h-auto rounded-none px-0 pb-2.5 text-[0.6875rem] font-medium tracking-[0.16em] uppercase hover:bg-transparent",
                lens === entry.id
                  ? "text-foreground"
                  : "text-foreground/45 hover:text-foreground/75",
              )}
            >
              {entry.label}
              <span
                aria-hidden
                className={cn(
                  "absolute inset-x-0 bottom-0 h-0.5 transition-colors",
                  lens === entry.id ? "bg-primary" : "bg-transparent",
                )}
              />
            </Button>
          ))}
        </div>
      </div>
      <DataTable
        classNames={registerStyles}
        columns={invoiceRegisterColumns}
        data={visible}
        emptyMessage="No invoices in this view. Confirm a quote to generate its billing."
        enableColumnResizing={false}
        getRowId={(row) => row.id}
        onRowClick={(row) => onSelect(row.id)}
        pageSize={20}
        toolbar={() => null}
      />
    </section>
  );
}
