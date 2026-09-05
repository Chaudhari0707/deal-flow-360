"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import useSWR from "swr";

import type { DataTableFeatures } from "@/components/ui/_types/data-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import type { FulfillmentList } from "@/features/inventory/_types/ui";
import { useStockFeed } from "@/features/inventory/use-stock-feed";
import { PageHeader } from "@/features/shell/page-header";
import { WorkspaceState } from "@/features/shell/workspace-state";

const columns: ColumnDef<DataTableFeatures, FulfillmentList["items"][number]>[] = [
  {
    accessorKey: "number",
    header: "Order",
    cell: ({ row }) => <span className="font-medium text-primary">{row.original.number}</span>,
  },
  { accessorKey: "customer", header: "Customer" },
  {
    accessorKey: "fulfillmentStatus",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.original.fulfillmentStatus === "BACKORDER" ? "destructive" : "secondary"}>
        {row.original.fulfillmentStatus.replaceAll("_", " ")}
      </Badge>
    ),
  },
  {
    accessorKey: "promisedDate",
    header: "Promised by",
    cell: ({ row }) => row.original.promisedDate ?? "Not set",
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString("en-IN"),
  },
];

export function FulfillmentScreen() {
  const router = useRouter();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
  const { data, error, mutate } = useSWR<FulfillmentList>(
    `/api/v1/fulfillment/orders?page=${pagination.pageIndex}&pageSize=${pagination.pageSize}`,
    { keepPreviousData: true },
  );
  const live = useStockFeed();
  if (!data) return <WorkspaceState error={error} retry={() => void mutate()} />;
  return (
    <>
      <PageHeader
        title="Fulfillment"
        description="From a confirmed quote to a completed delivery. Choose an order to review its warehouse plan."
        actions={<Badge variant="outline">{live}</Badge>}
      />
      <Card>
        <CardHeader>
          <CardTitle>Order dispatch queue</CardTitle>
          <CardDescription>
            Minimum shipments, protected reservations, and a clear path through backorders.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={data.items}
            getRowId={(row) => row.id}
            manualPagination
            pagination={pagination}
            pageCount={Math.ceil(data.total / pagination.pageSize)}
            onPaginationChange={setPagination}
            onRowClick={(row) => router.push(`/fulfillment/${encodeURIComponent(row.id)}`)}
            emptyMessage="Confirmed quotes will appear here automatically."
          />
        </CardContent>
      </Card>
    </>
  );
}
