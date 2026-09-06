"use client";
import { type ReactNode, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import useSWR from "swr";

import { CountValue } from "@/components/editorial/count-value";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { eyebrowType } from "@/features/billing/invoice-editorial";
import { ReportExportActions } from "@/features/billing/report-export-actions";
import { billingTableStyles, reportColumns, salesColumns } from "@/features/billing/table-columns";
import { money } from "@/features/shell/format";
import { PageHeader } from "@/features/shell/page-header";
import { useWorkspace } from "@/features/shell/use-workspace";
import { WorkspaceState } from "@/features/shell/workspace-state";
import { apiClient, apiData } from "@/lib/api/client";
import { cn } from "@/lib/utils";

/**
 * Section rule. Mirrors the shared table masthead so a hand-built section and a DataTable read
 * as the same object: a quiet letterspaced kicker over one firm rule, with the note beneath it.
 */
function SectionHead({
  actions,
  note,
  title,
}: {
  actions?: ReactNode;
  note?: string;
  title: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-b border-border-strong pb-3">
      <div className="min-w-0">
        <h2 className={cn(eyebrowType, "text-foreground")}>{title}</h2>
        {note ? <p className="mt-2 text-sm text-muted-foreground">{note}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
    </div>
  );
}

/**
 * A summary figure in the report band.
 *
 * `reports.spec` reads every headline value through `[data-slot="card"]`, so the slot stays on
 * the figure element — but the card box does not: the band's dividers, alignment and type scale
 * group these numbers now. `scale` is explicit because two of the sales metrics are sentences,
 * not figures, and prose set at figure size reads as a mistake.
 */
function Figure({
  accent = false,
  label,
  scale = "figure",
  value,
}: {
  accent?: boolean;
  label: string;
  scale?: "figure" | "text";
  value: ReactNode;
}) {
  return (
    <div data-slot="card" className="py-7 sm:px-8 sm:first:pl-0 sm:last:pr-0">
      <span
        aria-hidden
        className={cn("mb-4 block h-0.5 w-7", accent ? "bg-ink-accent" : "bg-transparent")}
      />
      <dt className={cn(eyebrowType, "text-muted-foreground")}>{label}</dt>
      <dd
        className={cn(
          "mt-3 font-medium text-foreground",
          scale === "figure"
            ? "text-[1.75rem] leading-none tracking-tight tabular-nums"
            : "text-lg leading-snug",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function isApprovalStatus(
  value: string,
): value is "APPROVED" | "NOT_SUBMITTED" | "PENDING" | "REJECTED" | "RETURNED" {
  return ["APPROVED", "NOT_SUBMITTED", "PENDING", "REJECTED", "RETURNED"].includes(value);
}

export function ReportWorkspace() {
  const workspace = useWorkspace();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reportTab, setReportTab] = useState<"sales" | "financial">("sales");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [customerId, setCustomerId] = useState("all");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [repId, setRepId] = useState("all");
  const [team, setTeam] = useState("all");
  const [approvalStatus, setApprovalStatus] = useState("all");
  const [productId, setProductId] = useState("all");
  const parameters = new URLSearchParams();
  if (from) parameters.set("from", from);
  if (to) parameters.set("to", to);
  if (customerId !== "all") parameters.set("customerId", customerId);
  if (category !== "all") parameters.set("category", category);
  if (status !== "all") parameters.set("status", status);
  if (repId !== "all") parameters.set("repId", repId);
  if (team !== "all") parameters.set("team", team);
  if (approvalStatus !== "all") parameters.set("approvalStatus", approvalStatus);
  if (productId !== "all") parameters.set("productId", productId);
  const url = `/api/v1/reports/financial?${parameters.toString()}`;
  const allowed =
    workspace.data && ["admin", "finance", "manager"].includes(workspace.data.actor.role);
  const invalid = Boolean(from && to && from > to);
  const report = useSWR(
    allowed && !invalid ? url : null,
    async () =>
      apiData(
        await apiClient.api.v1.reports.financial.get({
          query: {
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
            ...(customerId !== "all" ? { customerId } : {}),
            ...(category !== "all" ? { category } : {}),
            ...(status === "PAID" || status === "UNPAID" ? { status } : {}),
            ...(repId !== "all" ? { repId } : {}),
            ...(team !== "all" ? { team } : {}),
            ...(isApprovalStatus(approvalStatus) ? { approvalStatus } : {}),
            ...(productId !== "all" ? { productId } : {}),
          },
        }),
      ),
    { keepPreviousData: true },
  );
  if (!workspace.data)
    return <WorkspaceState error={workspace.error} retry={() => void workspace.mutate()} />;
  if (!allowed)
    return (
      <Alert>
        <AlertDescription>
          Reports are available to managers, finance and administrators.
        </AlertDescription>
      </Alert>
    );
  return (
    <div className="mx-auto w-full max-w-300 pb-6">
      <PageHeader
        title="Reports"
        description="Follow the complete sales journey, from quotations and approvals to confirmed orders, upsells and collected revenue."
        actions={
          <ReportExportActions
            enabled={!invalid && Boolean(report.data) && !report.isValidating && !report.error}
            format={reportTab === "sales" ? "pdf" : "xlsx"}
            url={url}
          />
        }
      />
      <section className="mt-11">
        <SectionHead
          title="Sales and financial report"
          note={
            parameters.size
              ? `${parameters.size} active filter${parameters.size === 1 ? "" : "s"}`
              : "All records · No filters applied"
          }
          actions={
            <Button
              type="button"
              variant="outline"
              aria-expanded={filtersOpen}
              aria-controls="report-filters"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              {filtersOpen ? <ChevronUp /> : <ChevronDown />}
              {filtersOpen ? "Hide filters" : "Show filters"}
            </Button>
          }
        />
        <div id="report-filters" hidden={!filtersOpen}>
          <p className="max-w-[92ch] pt-6 text-sm leading-relaxed text-muted-foreground">
            Dates use each quote/order creation date and each invoice/credit issue date in UTC.
            Product/category select whole records with matching lines. Payment status only filters
            financial records.
          </p>
          <div className="grid gap-x-10 gap-y-6 pt-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Field>
              <FieldLabel htmlFor="report-from">From</FieldLabel>
              <Input
                id="report-from"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="report-to">To</FieldLabel>
              <Input
                id="report-to"
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>Customer</FieldLabel>
              <Select
                value={customerId}
                onValueChange={(value) => {
                  if (value) setCustomerId(value);
                }}
              >
                <SelectTrigger aria-label="Report customer" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All customers</SelectItem>
                  {workspace.data.customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Category</FieldLabel>
              <Select
                value={category}
                onValueChange={(value) => {
                  if (value) setCategory(value);
                }}
              >
                <SelectTrigger aria-label="Report category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {[...new Set(workspace.data.products.map((product) => product.category))].map(
                    (value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Payment status</FieldLabel>
              <Select
                value={status}
                onValueChange={(value) => {
                  if (value) setStatus(value);
                }}
              >
                <SelectTrigger aria-label="Report status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="UNPAID">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {[
              {
                label: "Representative",
                value: repId,
                setValue: setRepId,
                items:
                  report.data?.options.representatives.map((rep) => ({
                    value: rep.id,
                    label: rep.name,
                  })) ?? [],
              },
              {
                label: "Team",
                value: team,
                setValue: setTeam,
                items: report.data?.options.teams.map((value) => ({ value, label: value })) ?? [],
              },
              {
                label: "Approval status",
                value: approvalStatus,
                setValue: setApprovalStatus,
                items: [
                  { value: "NOT_SUBMITTED", label: "Not submitted" },
                  { value: "PENDING", label: "Pending approval" },
                  { value: "APPROVED", label: "Approved current terms" },
                  { value: "RETURNED", label: "Returned" },
                  { value: "REJECTED", label: "Rejected" },
                ],
              },
              {
                label: "Product",
                value: productId,
                setValue: setProductId,
                items: workspace.data.products.map((product) => ({
                  value: product.id,
                  label: product.name,
                })),
              },
            ].map((field) => (
              <Field key={field.label}>
                <FieldLabel>{field.label}</FieldLabel>
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    if (value) field.setValue(value);
                  }}
                >
                  <SelectTrigger
                    aria-label={`Report ${field.label.toLowerCase()}`}
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {field.items.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ))}
          </div>
        </div>
      </section>
      {/*
       * The report-type switch is part of the page, not of a successful result: it decides which
       * register is on screen and which export the masthead offers. A rejected date range or a
       * failed refresh replaces the panels only — losing the tablist as well would strand a
       * reader on one export with no way back while they correct the dates.
       */}
      <Tabs
        className="mt-12"
        value={reportTab}
        onValueChange={(value) => {
          if (value === "sales" || value === "financial") setReportTab(value);
        }}
      >
        <TabsList aria-label="Report type">
          <TabsTrigger value="sales">Sales report</TabsTrigger>
          <TabsTrigger value="financial">Financial report</TabsTrigger>
        </TabsList>
        {invalid ? (
          <Alert variant="destructive">
            <AlertDescription>Start date must be before the end date.</AlertDescription>
          </Alert>
        ) : report.error || !report.data || report.isLoading ? (
          <WorkspaceState error={report.error} retry={() => void report.mutate()} />
        ) : (
          <>
            <TabsContent value="sales">
              <dl className="grid grid-cols-2 gap-x-10 sm:grid-cols-4 sm:gap-x-0 sm:divide-x sm:divide-border">
                <Figure
                  accent
                  label="Quotes created"
                  value={<CountValue value={report.data.sales.metrics.quotesCreated} />}
                />
                <Figure
                  label="Orders confirmed"
                  value={<CountValue value={report.data.sales.metrics.ordersConfirmed} />}
                />
                <Figure
                  scale="text"
                  label="Average approval time"
                  value={
                    report.data.sales.metrics.averageApprovalHours === null
                      ? "No completed cycles"
                      : `${report.data.sales.metrics.averageApprovalHours.toFixed(2)} hours`
                  }
                />
                <Figure
                  scale="text"
                  label="Top upsold product"
                  value={
                    report.data.sales.metrics.topUpsoldProduct
                      ? `${report.data.sales.metrics.topUpsoldProduct.name} · ${report.data.sales.metrics.topUpsoldProduct.quantity} units`
                      : "No confirmed upsells"
                  }
                />
              </dl>
              <div className="mt-7">
                <DataTable
                  title="Quotations and confirmed orders"
                  description={`Ordered value ${money(report.data.sales.metrics.orderedCents)}.`}
                  classNames={billingTableStyles}
                  columns={salesColumns}
                  data={[...report.data.sales.quotes, ...report.data.sales.orders]}
                  enableColumnResizing={false}
                  getRowId={(row) => `${row.kind}:${row.id}`}
                  emptyMessage="No sales records match these filters."
                />
              </div>
            </TabsContent>
            <TabsContent value="financial">
              <dl className="grid grid-cols-2 gap-x-10 sm:grid-cols-3 sm:gap-x-0 sm:divide-x sm:divide-border">
                <Figure
                  accent
                  label="Net billed"
                  value={<CountValue currency value={report.data.totals.billedCents} />}
                />
                <Figure
                  label="Payments collected"
                  value={<CountValue currency value={report.data.totals.paidCents} />}
                />
                <Figure
                  label="Outstanding"
                  value={<CountValue currency value={report.data.totals.outstandingCents} />}
                />
              </dl>
              <div className="mt-7">
                <DataTable
                  title={`${report.data.rows.length} financial records`}
                  classNames={billingTableStyles}
                  columns={reportColumns}
                  data={report.data.rows}
                  enableColumnResizing={false}
                  getRowId={(row) => row.number}
                  emptyMessage="No records match these filters."
                />
              </div>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
