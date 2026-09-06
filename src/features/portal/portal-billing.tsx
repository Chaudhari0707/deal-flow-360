"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, CreditCard } from "lucide-react";
import useSWR from "swr";

import type { DataTableFeatures } from "@/components/ui/_types/data-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, DataTableDefaultToolbar } from "@/components/ui/data-table";
import { PortalForbidden } from "@/features/portal/portal-forbidden";
import { displayDate, displayStatus, money } from "@/features/shell/format";
import { PageHeader } from "@/features/shell/page-header";
import { WorkspaceState } from "@/features/shell/workspace-state";
import { apiClient, apiData, HttpResponseError } from "@/lib/api/client";

type PortalInvoice = {
  createdAt: string;
  dueDate: string;
  id: string;
  kind: string;
  number: string;
  outstandingCents: number;
  paidCents: number;
  status: string;
  totalCents: number;
};

const columns: ColumnDef<DataTableFeatures, PortalInvoice>[] = [
  {
    accessorKey: "number",
    header: "Invoice",
    cell: ({ row }) => <span className="font-medium">{row.original.number}</span>,
  },
  {
    accessorKey: "kind",
    header: "Kind",
    cell: ({ row }) => displayStatus(row.original.kind),
  },
  {
    accessorKey: "dueDate",
    header: "Due",
    cell: ({ row }) => displayDate(row.original.dueDate),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.original.status === "PAID" ? "default" : "secondary"}>
        {displayStatus(row.original.status)}
      </Badge>
    ),
  },
  {
    accessorKey: "outstandingCents",
    header: "Outstanding",
    cell: ({ row }) => money(row.original.outstandingCents),
  },
  {
    id: "pay",
    header: "",
    cell: ({ row }) =>
      row.original.outstandingCents > 0 ? (
        <Button
          nativeButton={false}
          size="sm"
          aria-label={`Pay ${row.original.number}`}
          render={<Link href={`/portal/billing/pay/${row.original.id}`} />}
        >
          Pay
          <ArrowRight />
        </Button>
      ) : null,
  },
];

export function PortalBilling() {
  const { data, error, mutate } = useSWR("/api/v1/portal/billing/invoices", async () =>
    apiData(await apiClient.api.v1.portal.billing.invoices.get()),
  );
  if (error instanceof HttpResponseError && error.status === 403) return <PortalForbidden />;
  if (error instanceof HttpResponseError && error.status === 401)
    return (
      <Alert>
        <AlertTitle>Sign in to pay invoices</AlertTitle>
        <AlertDescription>
          Invoice payment requires your customer account. Open a secure portal link or sign in.
          <div className="mt-4">
            <Button nativeButton={false} render={<Link href="/login" />}>
              Sign in
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  if (error || !data)
    return (
      <WorkspaceState
        error={error}
        retry={() => {
          void mutate();
        }}
      />
    );
  return (
    <>
      <PageHeader
        title="Invoices"
        description="Pay outstanding invoices securely with Stripe. Finance can still record bank-reference payments."
      />
      <Card>
        <CardContent>
          {data.invoices.length ? (
            <DataTable
              toolbar={(table, extras) => (
                <DataTableDefaultToolbar
                  table={table}
                  title="Your invoices"
                  description="One-time, recurring, and adjustment invoices with an outstanding balance can be paid here."
                  searchColumn="number"
                  searchPlaceholder="Search invoices…"
                  actions={extras.bulkRemove}
                />
              )}
              columns={columns}
              data={data.invoices}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
              <CreditCard className="size-8 opacity-50" />
              <p>No invoices yet. Confirmed orders create invoices automatically.</p>
              <Button nativeButton={false} variant="outline" render={<Link href="/portal" />}>
                Back to quotations
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
