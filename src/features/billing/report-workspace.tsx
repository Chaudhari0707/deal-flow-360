"use client";
import { useState } from "react";
import useSWR from "swr";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { ReportRow } from "@/features/billing/_types/documents";
import type { ReportOptions, SalesReport } from "@/features/billing/_types/reports";
import { ReportExportActions } from "@/features/billing/report-export-actions";
import { reportColumns, salesColumns } from "@/features/billing/table-columns";
import { money } from "@/features/shell/format";
import { PageHeader } from "@/features/shell/page-header";
import { useWorkspace } from "@/features/shell/use-workspace";
import { WorkspaceState } from "@/features/shell/workspace-state";

export function ReportWorkspace() {
  const workspace = useWorkspace();
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
  const report = useSWR<{
    rows: ReportRow[];
    sales: SalesReport;
    options: ReportOptions;
    totals: { billedCents: number; outstandingCents: number; paidCents: number };
  }>(allowed && !invalid ? url : null, { keepPreviousData: true });
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
    <>
      <PageHeader
        title="Reports"
        description="Follow the complete sales journey, from quotations and approvals to confirmed orders, upsells and collected revenue."
        actions={
          <ReportExportActions
            enabled={!invalid && Boolean(report.data) && !report.isLoading}
            url={url}
          />
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Sales and financial report</CardTitle>
          <CardDescription>
            Dates use each quote/order creation date and each invoice/credit issue date in UTC.
            Product/category select whole records with matching lines. Payment status only filters
            financial records.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
        </CardContent>
      </Card>
      {invalid ? (
        <Alert variant="destructive">
          <AlertDescription>Start date must be before the end date.</AlertDescription>
        </Alert>
      ) : !report.data || report.isLoading ? (
        <WorkspaceState error={report.error} retry={() => void report.mutate()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Quotes created", value: String(report.data.sales.metrics.quotesCreated) },
              {
                label: "Orders confirmed",
                value: String(report.data.sales.metrics.ordersConfirmed),
              },
              {
                label: "Average approval time",
                value:
                  report.data.sales.metrics.averageApprovalHours === null
                    ? "No completed cycles"
                    : `${report.data.sales.metrics.averageApprovalHours.toFixed(2)} hours`,
              },
              {
                label: "Top upsold product",
                value: report.data.sales.metrics.topUpsoldProduct
                  ? `${report.data.sales.metrics.topUpsoldProduct.name} · ${report.data.sales.metrics.topUpsoldProduct.quantity} units`
                  : "No confirmed upsells",
              },
            ].map((metric) => (
              <Card key={metric.label}>
                <CardHeader>
                  <CardDescription>{metric.label}</CardDescription>
                  <CardTitle className="text-xl tabular-nums">{metric.value}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Quotations and confirmed orders</CardTitle>
              <CardDescription>
                Includes quotes with no invoice. Ordered value{" "}
                {money(report.data.sales.metrics.orderedCents)}. Approval average uses{" "}
                {report.data.sales.metrics.completedApprovalCycles} completed revision cycles;
                automatic approvals take zero hours.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={salesColumns}
                data={[...report.data.sales.quotes, ...report.data.sales.orders]}
                getRowId={(row) => `${row.kind}:${row.id}`}
                emptyMessage="No sales records match these filters."
              />
            </CardContent>
          </Card>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Net billed", value: report.data.totals.billedCents },
              { label: "Payments collected", value: report.data.totals.paidCents },
              { label: "Outstanding", value: report.data.totals.outstandingCents },
            ].map((metric) => (
              <Card key={metric.label}>
                <CardHeader>
                  <CardDescription>{metric.label}</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">{money(metric.value)}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{report.data.rows.length} financial records</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={reportColumns}
                data={report.data.rows}
                getRowId={(row) => row.number}
                emptyMessage="No records match these filters."
              />
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
