"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, Check, PackageCheck, Truck } from "lucide-react";
import useSWR from "swr";

import type { DataTableFeatures } from "@/components/ui/_types/data-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FulfillmentDetail as Detail } from "@/features/inventory/_types/ui";
import { OverrideForm } from "@/features/inventory/override-form";
import { PageHeader } from "@/features/shell/page-header";
import { useWorkspace } from "@/features/shell/use-workspace";
import { WorkspaceState } from "@/features/shell/workspace-state";
import { apiClient, apiData } from "@/lib/api/client";

export function FulfillmentDetail({
  id,
  back,
  compact = false,
}: {
  id: string;
  back: () => void;
  compact?: boolean;
}) {
  const { data, error, mutate } = useSWR(`/api/v1/fulfillment/${id}`, async () =>
    apiData(await apiClient.api.v1.fulfillment({ id }).get()),
  );
  const workspace = useWorkspace();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);
  const [operations, setOperations] = useState<Record<string, string>>({});
  const canOperate = workspace.data?.actor.role === "ops";
  async function action(
    kind: "accept" | "consolidate" | "ship",
    body?: { operationKey: string; quantity: number; reservationId: string },
  ) {
    setPending(true);
    setNotice("");
    try {
      const endpoint = apiClient.api.v1.fulfillment({ id });
      if (kind === "accept") apiData(await endpoint.accept.post());
      else if (kind === "consolidate") apiData(await endpoint.consolidate.post());
      else if (body) apiData(await endpoint.ship.post(body));
      else throw new Error("Shipment details are required");
      await Promise.all([mutate(), workspace.mutate()]);
      setFailed(false);
      setNotice(
        kind === "ship"
          ? "Shipment recorded. Reserved and on-hand stock updated together."
          : "Fulfillment updated successfully.",
      );
    } catch (e) {
      setFailed(true);
      setNotice(e instanceof Error ? e.message : "Unable to update fulfillment");
    } finally {
      setPending(false);
    }
  }
  const columns = useMemo<ColumnDef<DataTableFeatures, Detail["allocations"][number]>[]>(
    () => [
      { accessorKey: "product", header: "Product" },
      { accessorKey: "warehouse", header: "Warehouse" },
      { accessorKey: "quantity", header: "Allocated" },
      { accessorKey: "shipped", header: "Shipped" },
      {
        id: "pending",
        header: "Ready to ship",
        cell: ({ row }) => row.original.quantity - row.original.shipped,
      },
    ],
    [],
  );
  if (!data || !workspace.data)
    return (
      <WorkspaceState
        error={error ?? workspace.error}
        retry={() => {
          void mutate();
          void workspace.mutate();
        }}
      />
    );
  return (
    <>
      {!compact && (
        <PageHeader
          title={data.order.number}
          description="Review the split, dispatch reserved stock, and recover backorders when stock arrives."
          actions={
            <Button variant="outline" onClick={back}>
              <ArrowLeft />
              All orders
            </Button>
          }
        />
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>FULFILLMENT</CardDescription>
            <CardTitle>
              <Badge variant={data.backorders.length ? "destructive" : "secondary"}>
                {data.order.fulfillmentStatus.replaceAll("_", " ")}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {data.order.acceptedAt
              ? "Split accepted by operations"
              : "Awaiting operations acceptance"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>PENDING DISPATCHES</CardDescription>
            <CardTitle className="text-3xl">{data.shipmentCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Grouped by warehouse</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>RELATIVE SHIPPING SCORE</CardDescription>
            <CardTitle className="text-3xl">{data.shippingScore.toFixed(1)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            A comparison score, not a charge
          </CardContent>
        </Card>
      </div>
      {notice && (
        <Alert variant={failed ? "destructive" : "default"}>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      {data.backorders.length > 0 && (
        <Alert>
          <PackageCheck />
          <AlertTitle>Remaining backorder</AlertTitle>
          <AlertDescription>
            <div className="space-y-3">
              {data.backorders.map((line) => (
                <p key={line.productId}>
                  {line.quantity} × {line.product} awaiting stock
                </p>
              ))}
              {canOperate && (
                <Button disabled={pending} onClick={() => void action("consolidate")}>
                  Consolidate remaining backorder
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Warehouse split</CardTitle>
          <CardDescription>
            Stock was reserved at customer confirmation. Accepting the split reserves nothing twice.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DataTable
            columns={columns}
            data={data.allocations}
            getRowId={(row) => row.id}
            pageSize={20}
            emptyMessage="No stock allocation yet. Receive stock, then consolidate the backorder."
          />
          {canOperate && (
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={pending || Boolean(data.order.acceptedAt)}
                onClick={() => void action("accept")}
              >
                <Check />
                {data.order.acceptedAt ? "Split accepted" : "Accept suggested split"}
              </Button>
              <OverrideForm
                key={JSON.stringify(data.allocations)}
                detail={data}
                workspace={workspace.data}
                refresh={() => {
                  void mutate();
                  void workspace.mutate();
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>
      {canOperate &&
        data.order.acceptedAt &&
        data.allocations.some((a) => a.quantity > a.shipped) && (
          <Card>
            <CardHeader>
              <CardTitle>Dispatch reserved units</CardTitle>
              <CardDescription>
                Each action ships the remaining allocation. Repeated requests cannot dispatch twice.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {data.allocations
                .filter((a) => a.quantity > a.shipped)
                .map((allocation) => (
                  <Button
                    key={allocation.id}
                    disabled={pending}
                    variant="outline"
                    onClick={() => {
                      const key = `${allocation.id}:${allocation.shipped}:${allocation.quantity}`;
                      const operationKey = operations[key] ?? crypto.randomUUID();
                      setOperations((previous) => ({ ...previous, [key]: operationKey }));
                      void action("ship", {
                        operationKey,
                        reservationId: allocation.id,
                        quantity: allocation.quantity - allocation.shipped,
                      });
                    }}
                  >
                    <Truck />
                    Ship {allocation.quantity - allocation.shipped} {allocation.product} ·{" "}
                    {allocation.warehouse}
                  </Button>
                ))}
            </CardContent>
          </Card>
        )}
    </>
  );
}

export function FulfillmentDetailDialog({
  id,
  title,
  onClose,
}: {
  id: string;
  title: string;
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Review the warehouse plan, dispatch reservations, and manage backorders.
          </DialogDescription>
        </DialogHeader>
        <FulfillmentDetail id={id} back={onClose} compact />
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
