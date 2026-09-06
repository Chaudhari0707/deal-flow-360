"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { eyebrowType } from "@/components/editorial/editorial";
import { Button } from "@/components/ui/button";
import type { DataTableClassNames } from "@/components/ui/data-table";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuoteBoard } from "@/features/quotes/quote-board";
import { quoteColumns } from "@/features/quotes/quote-columns";
import { money } from "@/features/quotes/rules";
import { PageHeader } from "@/features/shell/page-header";
import { useWorkspace } from "@/features/shell/use-workspace";
import { WorkspaceState } from "@/features/shell/workspace-state";
import { cn } from "@/lib/utils";

/** Quiet label type: hierarchy from size, weight, case and letter-spacing, never from opacity. */

/**
 * The shared DataTable keeps sorting, resizing, pagination and keyboard-accessible rows; only
 * its outer box and gutters are replaced so the register aligns to the page measure.
 */
const registerStyles: DataTableClassNames = {
  cell: "px-0 pr-8 last:pr-0",
  emptyCell: "px-0 text-foreground",
  head: "px-0 pr-8 last:pr-0",
};

/**
 * The rule under the field replaces the input box, but the primitive's focus ring stays: the
 * border alone only shifts 2.66:1 between states in light, under the 3:1 a focus indicator owes.
 */
const searchField =
  "h-9 rounded-none border-0 border-b-2 border-border-strong bg-transparent px-0 text-sm focus-visible:border-ink-accent sm:max-w-sm dark:bg-transparent";

/**
 * A pipeline figure. The number is the primary visual element — large, tight and tabular so
 * the three read as one comparable band rather than three bordered tiles.
 */
function Figure({
  accent = false,
  label,
  value,
}: {
  accent?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="py-7 sm:px-8 sm:first:pl-0 sm:last:pr-0">
      <span
        aria-hidden
        className={cn("mb-4 block h-0.5 w-7", accent ? "bg-ink-accent" : "bg-transparent")}
      />
      <dt className={cn(eyebrowType, "text-muted-foreground")}>{label}</dt>
      <dd className="mt-3 text-[1.75rem] leading-none font-medium tracking-tight text-foreground tabular-nums">
        {value}
      </dd>
    </div>
  );
}

export function QuoteList({ approvals = false }: { approvals?: boolean }) {
  const { data, error, mutate } = useWorkspace();
  const [search, setSearch] = useState("");
  const router = useRouter();
  if (!data) return <WorkspaceState error={error} retry={() => void mutate()} />;
  const visible = data.quotes.filter(
    (q) =>
      (!approvals || q.status !== "DRAFT") &&
      `${q.number} ${data.customers.find((c) => c.id === q.customerId)?.name ?? ""} ${q.status}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const canCreate = data.actor.role === "rep";
  const tableRows = visible.map((quote) => ({
    ...quote,
    customerName:
      data.customers.find((customer) => customer.id === quote.customerId)?.name ?? "Customer",
  }));
  const openPipeline = data.quotes
    .filter((q) => !["CONFIRMED", "REJECTED"].includes(q.status))
    .reduce((sum, q) => sum + q.totalCents, 0);
  const waiting = data.quotes.filter((q) => q.status === "PENDING_APPROVAL").length;
  const confirmed = data.quotes.filter((q) => q.status === "CONFIRMED").length;
  return (
    <>
      <PageHeader
        title={approvals ? "Approval center" : "Quotations"}
        description={
          approvals
            ? "The right decision, with every reason in view. Review the current step and preserve the audit trail."
            : "From first conversation to a confirmed deal. Your pipeline, pricing and next steps in one place."
        }
        actions={
          canCreate && !approvals ? (
            <Button nativeButton={false} render={<Link href="/quotations/new" />}>
              <Plus data-icon="inline-start" />
              New quotation
            </Button>
          ) : undefined
        }
      />
      <dl className="grid grid-cols-1 divide-y divide-border border-t border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Figure accent label="Open pipeline" value={money(openPipeline)} />
        <Figure label="Waiting for approval" value={String(waiting)} />
        <Figure label="Confirmed deals" value={String(confirmed)} />
      </dl>
      <Tabs defaultValue={approvals ? "table" : "board"}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="table">Table</TabsTrigger>
          </TabsList>
          <Input
            aria-label="Search quotations"
            placeholder="Search customer, quotation or stage…"
            className={searchField}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <TabsContent value="board" className="overflow-visible">
          <QuoteBoard
            quotes={visible}
            customers={data.customers}
            role={data.actor.role}
            mutate={mutate}
          />
        </TabsContent>
        <TabsContent value="table">
          <DataTable
            title="Quotations"
            classNames={registerStyles}
            columns={quoteColumns}
            data={tableRows}
            getRowId={(q) => q.id}
            onRowClick={(q) => router.push(`/quotations/${q.id}`)}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
