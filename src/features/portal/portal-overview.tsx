"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, FileText } from "lucide-react";
import useSWR from "swr";

import type { DataTableFeatures } from "@/components/ui/_types/data-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, DataTableDefaultToolbar } from "@/components/ui/data-table";
import type { PortalWorkspace } from "@/features/portal/_types/portal";
import { PortalForbidden } from "@/features/portal/portal-forbidden";
import { displayDate, displayStatus, money } from "@/features/shell/format";
import { PageHeader } from "@/features/shell/page-header";
import { WorkspaceState } from "@/features/shell/workspace-state";
import { apiClient, apiData, HttpResponseError } from "@/lib/api/client";

const columns: ColumnDef<DataTableFeatures, PortalWorkspace["quotes"][number]>[] = [
  {
    accessorKey: "number",
    header: "Quotation",
    cell: ({ row }) => (
      <Link className="font-medium hover:underline" href={`/portal/${row.original.id}`}>
        {row.original.number}
      </Link>
    ),
  },
  {
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ row }) => displayDate(row.original.updatedAt),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.original.status === "CONFIRMED" ? "default" : "secondary"}>
        {displayStatus(row.original.status)}
      </Badge>
    ),
  },
  {
    accessorKey: "totalCents",
    header: "One-time total",
    cell: ({ row }) => money(row.original.totalCents),
  },
  {
    id: "open",
    header: "",
    cell: ({ row }) => (
      <Button
        nativeButton={false}
        variant="ghost"
        size="icon-sm"
        aria-label={`Open ${row.original.number}`}
        render={<Link href={`/portal/${row.original.id}`} />}
      >
        <ArrowRight />
      </Button>
    ),
  },
];

export function PortalOverview() {
  const { data, error, mutate } = useSWR("/api/v1/portal", async () =>
    apiData(await apiClient.api.v1.portal.get()),
  );
  const router = useRouter();
  if (error instanceof HttpResponseError && error.status === 403) return <PortalForbidden />;
  if (error instanceof HttpResponseError && error.status === 401)
    return (
      <Alert>
        <AlertTitle>Welcome to your customer portal</AlertTitle>
        <AlertDescription>
          Open the secure link in your quotation email, or sign in with your customer account.
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
        title="Your workspace"
        description={
          data.customer
            ? `Welcome, ${data.customer.name}. Review your quotes, ask questions, and move forward with confidence.`
            : "Review shared quotations and the conversations that bring your next order together."
        }
      />
      <Card>
        <CardContent>
          {data.quotes.length ? (
            <DataTable
              toolbar={(table, extras) => (
                <DataTableDefaultToolbar
                  table={table}
                  title="Your quotations"
                  description="Open a quotation to review line items, discuss changes, or confirm your order."
                  searchColumn="number"
                  searchPlaceholder="Search quotations…"
                  actions={extras.bulkRemove}
                />
              )}
              columns={columns}
              data={data.quotes}
              getRowId={(row) => row.id}
              onRowClick={(row) => router.push(`/portal/${row.id}`)}
              emptyMessage="No quotations yet"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <FileText className="size-9 text-muted-foreground" />
              <h2 className="text-lg font-medium">No quotations yet</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                Your account manager will share your quotation here when it's ready for review.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
