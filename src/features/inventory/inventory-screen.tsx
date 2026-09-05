"use client";

import { useState } from "react";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Package, RefreshCw, Warehouse } from "lucide-react";
import useSWR from "swr";

import type { DataTableFeatures } from "@/components/ui/_types/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import type { StockRow } from "@/features/inventory/_types/ui";
import { RestockDialog } from "@/features/inventory/restock-form";
import { StockSetup } from "@/features/inventory/stock-setup";
import { useStockFeed } from "@/features/inventory/use-stock-feed";
import { WarehouseSettings } from "@/features/inventory/warehouse-settings";
import { PageHeader } from "@/features/shell/page-header";
import { useWorkspace } from "@/features/shell/use-workspace";
import { WorkspaceState } from "@/features/shell/workspace-state";
import { apiClient, apiData } from "@/lib/api/client";

const columns: ColumnDef<DataTableFeatures, StockRow>[] = [
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
  { accessorKey: "warehouse", header: "Warehouse" },
  { accessorKey: "onHand", header: "On hand" },
  { accessorKey: "reserved", header: "Reserved" },
  {
    accessorKey: "available",
    header: "Available",
    cell: ({ row }) => (
      <Badge
        variant={
          row.original.available <= row.original.replenishmentThreshold
            ? "destructive"
            : "secondary"
        }
      >
        {row.original.available}
      </Badge>
    ),
  },
  {
    id: "health",
    header: "Replenishment",
    cell: ({ row }) =>
      row.original.available <= row.original.replenishmentThreshold
        ? "Restock suggested"
        : "Healthy",
  },
];

export function InventoryScreen() {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
  const [selected, setSelected] = useState<string>();
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
  const canOperate = ["admin", "ops"].includes(workspace.data?.actor.role ?? "");
  const stock = data.stocks.find((s) => s.id === selected);
  return (
    <>
      <PageHeader
        title="Inventory"
        description="Every unit accounted for, across every warehouse. Select a stock row to receive a delivery."
        actions={
          <>
            <Badge variant="outline">{live}</Badge>
            {workspace.data?.actor.role === "admin" && (
              <>
                <WarehouseSettings
                  refresh={() => {
                    void mutate();
                    void workspace.mutate();
                  }}
                />
                <StockSetup
                  workspace={workspace.data}
                  refresh={() => {
                    void mutate();
                    void workspace.mutate();
                  }}
                />
              </>
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
              <CardDescription className="flex items-center gap-2">
                <Warehouse className="size-4" />
                WAREHOUSE
              </CardDescription>
              <CardTitle className="flex items-center justify-between">
                {warehouse.name}
                <Badge variant={warehouse.active ? "secondary" : "outline"}>
                  {warehouse.active ? "Active" : "Paused"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Shipping score{" "}
                <strong className="text-foreground">
                  {(warehouse.shippingWeight / 100).toFixed(1)}
                </strong>{" "}
                · Alert below {warehouse.replenishmentThreshold} units
              </p>
              {workspace.data?.actor.role === "admin" && (
                <WarehouseSettings warehouse={warehouse} refresh={() => void mutate()} />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="size-5" />
            Stock balances
          </CardTitle>
          <CardDescription>
            Available = on hand − reserved. Confirmed orders keep their units protected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={data.stocks}
            getRowId={(row) => row.id}
            manualPagination
            pagination={pagination}
            pageCount={Math.ceil(data.total / pagination.pageSize)}
            onPaginationChange={setPagination}
            onRowClick={canOperate ? (row) => setSelected(row.id) : undefined}
            emptyMessage="No stock configured at these warehouses."
          />
        </CardContent>
      </Card>
      {stock && canOperate && (
        <RestockDialog
          key={stock.id}
          stock={stock}
          open
          onOpenChange={(open) => {
            if (!open) setSelected(undefined);
          }}
          refresh={() => void mutate()}
        />
      )}
    </>
  );
}
