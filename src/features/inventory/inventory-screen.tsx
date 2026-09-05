"use client";

import { useState } from "react";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { RefreshCw } from "lucide-react";
import useSWR from "swr";

import type { DataTableFeatures } from "@/components/ui/_types/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import type { InventoryProductRow } from "@/features/inventory/_types/ui";
import { RestockDialog } from "@/features/inventory/restock-form";
import { restockLocations } from "@/features/inventory/restock-locations";
import { useStockFeed } from "@/features/inventory/use-stock-feed";
import { WarehouseSettings } from "@/features/inventory/warehouse-settings";
import { PageHeader } from "@/features/shell/page-header";
import { useWorkspace } from "@/features/shell/use-workspace";
import { WorkspaceState } from "@/features/shell/workspace-state";
import { apiClient, apiData } from "@/lib/api/client";

const columns: ColumnDef<DataTableFeatures, InventoryProductRow>[] = [
  {
    accessorKey: "name",
    header: "Product",
    cell: ({ row }) => (
      <div>
        <span className="font-medium">{row.original.name}</span>
        <span className="block text-xs text-muted-foreground">{row.original.variant}</span>
      </div>
    ),
  },
];

export function InventoryScreen() {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
  const [selectedProductId, setSelectedProductId] = useState<string>();
  const { data, error, mutate } = useSWR(
    `/api/v1/inventory?page=${pagination.pageIndex}&pageSize=${pagination.pageSize}`,
    async () =>
      apiData(
        await apiClient.api.v1.inventory.get({
          query: { page: pagination.pageIndex, pageSize: pagination.pageSize },
        }),
      ),
    { keepPreviousData: true },
  );
  const workspace = useWorkspace();
  const live = useStockFeed();
  if (!data) return <WorkspaceState error={error} retry={() => void mutate()} />;
  const canRestock = workspace.data?.actor.role === "admin";
  const locations = selectedProductId ? restockLocations(data, selectedProductId) : [];
  const stock = locations[0];
  return (
    <>
      <PageHeader
        title="Inventory"
        description="Select a product to receive stock. Choose the warehouse in the receipt dialog; its current quantity is shown there."
        actions={
          <>
            {live ? <Badge variant="outline">{live}</Badge> : null}
            {workspace.data?.actor.role === "admin" && (
              <WarehouseSettings
                warehouses={data.warehouses}
                refresh={() => {
                  void mutate();
                  void workspace.mutate();
                }}
              />
            )}
            <Button
              variant="outline"
              size="icon"
              aria-label="Refresh inventory"
              onClick={() => void mutate()}
            >
              <RefreshCw />
            </Button>
          </>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        {data.warehouses.map((warehouse) => (
          <Card key={warehouse.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                {warehouse.name}
                <Badge variant={warehouse.active ? "secondary" : "outline"}>
                  {warehouse.active ? "Active" : "Paused"}
                </Badge>
              </CardTitle>
              <CardDescription>
                Low-stock alert below {warehouse.replenishmentThreshold} units
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {canRestock && workspace.data && (
                <div className="flex flex-wrap gap-2">
                  <WarehouseSettings
                    warehouse={warehouse}
                    warehouses={data.warehouses}
                    refresh={() => void mutate()}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent>
          <DataTable
            title="Products"
            description="Select a product to receive stock at any warehouse."
            columns={columns}
            data={data.products}
            getRowId={(row) => row.id}
            manualPagination
            pagination={pagination}
            pageCount={Math.ceil(data.total / pagination.pageSize)}
            onPaginationChange={setPagination}
            onRowClick={canRestock ? (row) => setSelectedProductId(row.id) : undefined}
            emptyMessage="No stockable products are available."
          />
        </CardContent>
      </Card>
      {stock && selectedProductId && canRestock && (
        <RestockDialog
          key={selectedProductId}
          locations={locations}
          stock={stock}
          open
          onOpenChange={(open) => {
            if (!open) setSelectedProductId(undefined);
          }}
          refresh={() => void mutate()}
        />
      )}
    </>
  );
}
