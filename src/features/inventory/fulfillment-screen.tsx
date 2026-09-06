"use client";

import { useState } from "react";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import useSWR from "swr";

import type { DataTableFeatures } from "@/components/ui/_types/data-table";
import { DataTable } from "@/components/ui/data-table";
import type { FulfillmentList } from "@/features/inventory/_types/ui";
import { FulfillmentDetailDialog } from "@/features/inventory/fulfillment-detail";
import { operationalTable, StatusMark } from "@/features/inventory/inventory-editorial";
import { PageHeader } from "@/features/shell/page-header";
import { WorkspaceState } from "@/features/shell/workspace-state";
import { apiClient, apiData } from "@/lib/api/client";

const columns: ColumnDef<DataTableFeatures, FulfillmentList["items"][number]>[] = [
  {
    accessorKey: "number",
    header: "Order",
    cell: ({ row }) => <span className="font-medium text-foreground">{row.original.number}</span>,
  },
  {
    accessorKey: "customer",
    header: "Customer",
    cell: ({ row }) => <span className="text-foreground">{row.original.customer}</span>,
  },
  {
    accessorKey: "fulfillmentStatus",
    header: "Status",
    cell: ({ row }) => <StatusMark status={row.original.fulfillmentStatus} />,
  },
  {
    accessorKey: "promisedDate",
    header: "Promised by",
    cell: ({ row }) => (
      <span className="text-muted-foreground tabular-nums">
        {row.original.promisedDate ?? "Not set"}
      </span>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => (
      <span className="text-muted-foreground tabular-nums">
        {new Date(row.original.createdAt).toLocaleDateString("en-IN")}
      </span>
    ),
  },
];

export function FulfillmentScreen() {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
  const [selected, setSelected] = useState<string>();
  const { data, error, mutate } = useSWR(
    `/api/v1/fulfillment/orders?page=${pagination.pageIndex}&pageSize=${pagination.pageSize}`,
    async () =>
      apiData(
        await apiClient.api.v1.fulfillment.orders.get({
          query: { page: pagination.pageIndex, pageSize: pagination.pageSize },
        }),
      ),
    { keepPreviousData: true },
  );
  if (!data) return <WorkspaceState error={error} retry={() => void mutate()} />;
  const selectedOrder = data.items.find((item) => item.id === selected);
  return (
    <div className="w-full">
      <PageHeader
        title="Fulfillment"
        description="From a confirmed quote to a completed delivery. Choose an order to review its warehouse plan."
      />
      <section className="mt-10">
        <DataTable
          classNames={operationalTable}
          title="Order dispatch queue"
          description="Accept shipment, then Ship. Consolidate remaining backorder when stock arrives."
          columns={columns}
          data={data.items}
          enableColumnResizing={false}
          getRowId={(row) => row.id}
          initialSorting={[{ id: "createdAt", desc: true }]}
          manualPagination
          pagination={pagination}
          pageCount={Math.ceil(data.total / pagination.pageSize)}
          onPaginationChange={setPagination}
          onRowClick={(row) => setSelected(row.id)}
          emptyMessage="Confirmed quotes will appear here automatically."
        />
      </section>
      {selectedOrder && (
        <FulfillmentDetailDialog
          id={selectedOrder.id}
          title={selectedOrder.number}
          onClose={() => {
            setSelected(undefined);
            void mutate();
          }}
        />
      )}
    </div>
  );
}
