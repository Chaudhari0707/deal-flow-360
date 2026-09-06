"use client";

import { useMemo, useState } from "react";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { RefreshCw } from "lucide-react";
import useSWR from "swr";

import type { DataTableFeatures } from "@/components/ui/_types/data-table";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import type { InventoryProductRow, InventorySnapshot } from "@/features/inventory/_types/ui";
import {
  eyebrowType,
  numericCell,
  operationalTable,
} from "@/features/inventory/inventory-editorial";
import { RestockDialog } from "@/features/inventory/restock-form";
import { restockLocations } from "@/features/inventory/restock-locations";
import { useStockFeed } from "@/features/inventory/use-stock-feed";
import { WarehouseSettings } from "@/features/inventory/warehouse-settings";
import { PageHeader } from "@/features/shell/page-header";
import { useWorkspace } from "@/features/shell/use-workspace";
import { WorkspaceState } from "@/features/shell/workspace-state";
import { apiClient, apiData } from "@/lib/api/client";
import { cn } from "@/lib/utils";

/**
 * Inventory is the densest surface in the product, so nothing here is a card. Warehouse policy
 * reads as a hairline-divided band, stock reads as a ruled register, and every balance is a
 * right-aligned tabular figure so quantities compare straight down the column.
 */
const noBalance = { available: 0, onHand: 0, reserved: 0 };

/** Roll the per-warehouse balances of the current page into one row per product. */
function balancesByProduct(stocks: InventorySnapshot["stocks"]) {
  const totals = new Map<string, typeof noBalance>();
  for (const row of stocks) {
    const current = totals.get(row.productId) ?? noBalance;
    totals.set(row.productId, {
      available: current.available + row.available,
      onHand: current.onHand + row.onHand,
      reserved: current.reserved + row.reserved,
    });
  }
  return totals;
}

function inventoryColumns(
  stocks: InventorySnapshot["stocks"],
): ColumnDef<DataTableFeatures, InventoryProductRow>[] {
  const totals = balancesByProduct(stocks);
  const balance = (product: InventoryProductRow) => totals.get(product.id) ?? noBalance;
  return [
    {
      accessorKey: "name",
      header: "Product",
      cell: ({ row }) => (
        <span className="block">
          <span className="block font-medium text-foreground">{row.original.name}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{row.original.variant}</span>
        </span>
      ),
    },
    {
      id: "onHand",
      header: () => <span className="block text-right">On hand</span>,
      cell: ({ row }) => (
        <span className={cn(numericCell, "font-medium text-foreground")}>
          {balance(row.original).onHand}
        </span>
      ),
    },
    {
      id: "reserved",
      header: () => <span className="block text-right">Reserved</span>,
      cell: ({ row }) => (
        <span className={cn(numericCell, "text-muted-foreground")}>
          {balance(row.original).reserved}
        </span>
      ),
    },
    {
      id: "available",
      header: () => <span className="block text-right">Available</span>,
      cell: ({ row }) => {
        const available = balance(row.original).available;
        return (
          <span className={cn(numericCell, available > 0 ? "text-foreground" : "text-ink-risk")}>
            {available}
          </span>
        );
      },
    },
  ];
}

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
  const stocks = data?.stocks;
  const columns = useMemo(() => inventoryColumns(stocks ?? []), [stocks]);
  if (!data) return <WorkspaceState error={error} retry={() => void mutate()} />;
  const canRestock = workspace.data?.actor.role === "admin" || workspace.data?.actor.role === "ops";
  const locations = selectedProductId ? restockLocations(data, selectedProductId) : [];
  const stock = locations[0];
  // The feed only surfaces two states: the connected label, or a session warning worth an ink.
  const streaming = live === "Live stock";
  return (
    <div className="w-full">
      <PageHeader
        title="Inventory"
        description={
          canRestock
            ? "Select a product to receive stock. Choose the warehouse in the receipt dialog; its current quantity is shown there."
            : "Review stockable products and select one to receive stock at a warehouse."
        }
        actions={
          <>
            {live ? (
              <span className="inline-flex items-center gap-2 text-xs">
                <span
                  aria-hidden
                  className={cn("size-1.5 shrink-0", streaming ? "bg-ink-accent" : "bg-ink-risk")}
                />
                <span className={streaming ? "text-muted-foreground" : "text-ink-risk"}>
                  {live}
                </span>
              </span>
            ) : null}
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

      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3 border-b border-border-strong pb-3">
          <h2 className={cn(eyebrowType, "text-foreground")}>Warehouses</h2>
          {workspace.data?.actor.role === "admin" && (
            <WarehouseSettings
              warehouses={data.warehouses}
              refresh={() => {
                void mutate();
                void workspace.mutate();
              }}
            />
          )}
        </div>
        <dl>
          {data.warehouses.map((warehouse) => (
            <div
              key={warehouse.id}
              className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3 border-b border-border py-4"
            >
              <div className="min-w-0">
                <dt className={cn(eyebrowType, "text-muted-foreground")}>{warehouse.name}</dt>
                <dd className="mt-2 text-xs text-muted-foreground tabular-nums">
                  Low-stock alert below {warehouse.replenishmentThreshold} units
                </dd>
              </div>
              <dd className="flex items-center gap-6">
                <span className="inline-flex items-center gap-2 text-sm whitespace-nowrap">
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 shrink-0",
                      warehouse.active ? "bg-ink-accent" : "bg-muted-foreground",
                    )}
                  />
                  <span className={warehouse.active ? "text-foreground" : "text-muted-foreground"}>
                    {warehouse.active ? "Active" : "Paused"}
                  </span>
                </span>
                {canRestock && workspace.data && (
                  <WarehouseSettings
                    warehouse={warehouse}
                    warehouses={data.warehouses}
                    refresh={() => void mutate()}
                  />
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-12">
        <DataTable
          classNames={operationalTable}
          title="Products"
          description="Select a product to receive stock at any warehouse."
          columns={columns}
          data={data.products}
          enableColumnResizing={false}
          getRowId={(row) => row.id}
          manualPagination
          pagination={pagination}
          pageCount={Math.ceil(data.total / pagination.pageSize)}
          onPaginationChange={setPagination}
          onRowClick={canRestock ? (row) => setSelectedProductId(row.id) : undefined}
          emptyMessage="No stockable products are available."
        />
      </section>

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
    </div>
  );
}
