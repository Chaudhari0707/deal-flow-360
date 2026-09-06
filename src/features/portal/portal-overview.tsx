"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight } from "lucide-react";
import useSWR from "swr";

import { eyebrowType } from "@/components/editorial/editorial";
import type { DataTableFeatures } from "@/components/ui/_types/data-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DataTableClassNames } from "@/components/ui/data-table";
import { DataTable, DataTableDefaultToolbar } from "@/components/ui/data-table";
import type { PortalWorkspace } from "@/features/portal/_types/portal";
import { PortalForbidden } from "@/features/portal/portal-forbidden";
import { displayDate, displayStatus, money } from "@/features/shell/format";
import { PageHeader } from "@/features/shell/page-header";
import { WorkspaceState } from "@/features/shell/workspace-state";
import { apiClient, apiData, HttpResponseError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

/** Quiet label type: hierarchy from size, weight, case and letter-spacing, never from opacity. */

/**
 * The customer register keeps every DataTable behaviour and drops its chrome: no outer box, a
 * single rule under letterspaced headers, hairline rows and right-aligned tabular money. This is
 * the one surface that may breathe, so rows sit taller here than in the internal registers.
 */
const registerStyles: DataTableClassNames = {
  cell: "px-0 py-5 pr-8 align-middle last:pr-0",
  emptyCell: "px-0 text-left text-muted-foreground",
  head: "h-auto px-0 pt-0 pr-8 pb-3 text-[0.6875rem] tracking-[0.16em] last:pr-0",
  row: "border-0",
  table: "text-sm",
};

const columns: ColumnDef<DataTableFeatures, PortalWorkspace["quotes"][number]>[] = [
  {
    accessorKey: "number",
    header: "Quotation",
    cell: ({ row }) => (
      <Link
        className="font-medium text-foreground underline-offset-4 hover:underline"
        href={`/portal/${row.original.id}`}
      >
        {row.original.number}
      </Link>
    ),
  },
  {
    accessorKey: "updatedAt",
    header: "Updated",
    cell: ({ row }) => (
      <span className="text-muted-foreground tabular-nums">
        {displayDate(row.original.updatedAt)}
      </span>
    ),
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
    header: () => <span className="block text-right">One-time total</span>,
    cell: ({ row }) => (
      <span className="block text-right font-medium text-foreground tabular-nums">
        {money(row.original.totalCents)}
      </span>
    ),
  },
  {
    id: "open",
    header: "",
    cell: ({ row }) => (
      <span className="flex justify-end">
        <Button
          nativeButton={false}
          variant="ghost"
          size="icon-sm"
          aria-label={`Open ${row.original.number}`}
          render={<Link href={`/portal/${row.original.id}`} />}
        >
          <ArrowRight />
        </Button>
      </span>
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
      <Alert className="max-w-[60ch] py-1">
        <AlertTitle className="text-base">Welcome to your customer portal</AlertTitle>
        <AlertDescription>
          <span className="block leading-relaxed">
            Open the secure link in your quotation email, or sign in with your customer account.
          </span>
          <div className="mt-5">
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
      <section className="mt-6">
        {data.quotes.length ? (
          <DataTable
            classNames={registerStyles}
            toolbar={(table, extras) => (
              <DataTableDefaultToolbar
                table={table}
                title="Your quotations"
                description="Open a quotation to review line items, discuss changes, or confirm your order."
                searchColumn="number"
                searchPlaceholder="Search quotations…"
                actions={extras.bulkRemove}
                pageNav={extras.pageNav}
              />
            )}
            columns={columns}
            data={data.quotes}
            getRowId={(row) => row.id}
            onRowClick={(row) => router.push(`/portal/${row.id}`)}
            emptyMessage="No quotations yet"
          />
        ) : (
          <div className="border-t border-border-strong pt-12 pb-16">
            <h2 className={cn(eyebrowType, "text-muted-foreground")}>No quotations yet</h2>
            <p className="mt-4 max-w-[46ch] text-[0.9375rem] leading-relaxed text-foreground">
              Your account manager will share your quotation here when it's ready for review.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
