"use client";
import { useState } from "react";
import { DownloadIcon } from "lucide-react";
import useSWR from "swr";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { reportColumns } from "@/features/billing/table-columns";
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
  const parameters = new URLSearchParams();
  if (from) parameters.set("from", from);
  if (to) parameters.set("to", to);
  if (customerId !== "all") parameters.set("customerId", customerId);
  if (category !== "all") parameters.set("category", category);
  if (status !== "all") parameters.set("status", status);
  const url = `/api/v1/reports/financial?${parameters.toString()}`;
  const allowed =
    workspace.data && ["admin", "finance", "manager"].includes(workspace.data.actor.role);
  const invalid = Boolean(from && to && from > to);
  const report = useSWR<{
    rows: ReportRow[];
    totals: { billedCents: number; outstandingCents: number; paidCents: number };
  }>(allowed && !invalid ? url : null);
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
        description="Trace financial performance to invoices and credit notes. Export the same filtered rows you review here."
        actions={
          <>
            <Button
              variant="outline"
              disabled={invalid || !report.data}
              nativeButton={false}
              render={<a aria-label="Download report PDF" href={`${url}&format=pdf`} />}
            >
              <DownloadIcon />
              PDF
            </Button>
            <Button
              disabled={invalid || !report.data}
              nativeButton={false}
              render={<a aria-label="Download report Excel" href={`${url}&format=xlsx`} />}
            >
              <DownloadIcon />
              Excel
            </Button>
          </>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Financial report</CardTitle>
          <CardDescription>
            Dates use invoice issue date in UTC. Category selects whole invoices containing that
            category. Credit notes reduce net billed; available credits are not cash refunds.
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
            <FieldLabel>Status</FieldLabel>
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
        </CardContent>
      </Card>
      {invalid ? (
        <Alert variant="destructive">
          <AlertDescription>Start date must be before the end date.</AlertDescription>
        </Alert>
      ) : !report.data ? (
        <WorkspaceState error={report.error} retry={() => void report.mutate()} />
      ) : (
        <>
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
