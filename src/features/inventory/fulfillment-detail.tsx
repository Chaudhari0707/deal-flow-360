"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft, Check, PackageCheck, Truck } from "lucide-react";
import useSWR, { useSWRConfig } from "swr";

import type { DataTableFeatures } from "@/components/ui/_types/data-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FulfillmentDetail as Detail } from "@/features/inventory/_types/ui";
import {
  displayFulfillmentStatus,
  fulfillmentActions,
  fulfillmentNextStep,
  NO_STOCK_AVAILABLE,
  remainingBackorderUnits,
  stillNeededLabel,
  stillNeededLine,
  warehouseAvailability,
} from "@/features/inventory/fulfillment-copy";
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
  const { mutate: mutateKeys } = useSWRConfig();
  const workspace = useWorkspace();
  const revalidate = () =>
    Promise.all([
      mutate(),
      workspace.mutate(),
      mutateKeys((key) => typeof key === "string" && key.startsWith("/api/v1/fulfillment/orders")),
    ]);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);
  const [operations, setOperations] = useState<Record<string, string>>({});
  const role = workspace.data?.actor.role;
  const canOperate = role === "ops";
  const canConsolidate = role === "ops" || role === "admin";
  async function action(
    kind: "accept" | "consolidate" | "ship",
    body?: { operationKey: string; quantity: number; reservationId: string },
  ) {
    setPending(true);
    setNotice("");
    try {
      const endpoint = apiClient.api.v1.fulfillment({ id });
      if (kind === "accept") apiData(await endpoint.accept.post());
      else if (kind === "consolidate") {
        const plan = apiData(await endpoint.consolidate.post());
        const reserved = plan.allocations.reduce((sum, line) => sum + line.quantity, 0);
        const leftover = plan.backorders.reduce((sum, line) => sum + line.quantity, 0);
        await revalidate();
        setFailed(false);
        setNotice(
          leftover > 0
            ? `Reserved ${reserved} more units from available warehouses. ${leftover} still needed.`
            : `Reserved ${reserved} units from available warehouses. Remaining backorder is filled.`,
        );
        return;
      } else if (body) apiData(await endpoint.ship.post(body));
      else throw new Error("Shipment details are required");
      await revalidate();
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
  if (!data || !workspace.data) {
    const state = (
      <WorkspaceState
        error={error ?? workspace.error}
        retry={() => {
          void revalidate();
        }}
      />
    );
    return compact ? <DialogBody>{state}</DialogBody> : state;
  }
  const workspaceData = workspace.data;
  const refresh = () => {
    void revalidate();
  };
  const remainingUnits = remainingBackorderUnits(data.backorders);
  const unshipped = data.allocations.some((row) => row.quantity > row.shipped);
  const availableForBackorder = data.backorders.some(
    (line) =>
      warehouseAvailability(line.productId, workspaceData.warehouses, workspaceData.stocks).length >
      0,
  );
  const actions = fulfillmentActions({
    accepted: Boolean(data.order.acceptedAt),
    availableForBackorder,
    status: data.order.fulfillmentStatus,
    unshipped,
  });
  const nextStep = fulfillmentNextStep(data.order.fulfillmentStatus, actions);
  const shipmentActions = canOperate ? (
    <>
      {actions.accept && (
        <Button disabled={pending} onClick={() => void action("accept")}>
          <Check />
          Accept shipment
        </Button>
      )}
      {actions.override && (
        <OverrideForm
          key={JSON.stringify(data.allocations)}
          detail={data}
          workspace={workspaceData}
          refresh={refresh}
        />
      )}
    </>
  ) : null;
  const body = (
    <div className={compact ? "grid gap-3" : "grid gap-4"}>
      {nextStep && <p className="text-sm text-muted-foreground">{nextStep}</p>}
      {compact ? (
        <dl className="grid grid-cols-3 gap-2 rounded-lg border px-3 py-2">
          <div>
            <dt className="text-xs text-muted-foreground">Status</dt>
            <dd className="mt-1">
              <Badge variant={data.backorders.length ? "destructive" : "secondary"}>
                {displayFulfillmentStatus(data.order.fulfillmentStatus)}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Still needed</dt>
            <dd className="mt-1 font-medium">{remainingUnits}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Pending shipments</dt>
            <dd className="mt-1 font-medium">{data.shipmentCount}</dd>
          </div>
        </dl>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Status</CardDescription>
              <CardTitle>
                <Badge variant={data.backorders.length ? "destructive" : "secondary"}>
                  {displayFulfillmentStatus(data.order.fulfillmentStatus)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {data.order.acceptedAt
                ? "Shipment accepted by operations"
                : "Awaiting operations acceptance"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Pending shipments</CardDescription>
              <CardTitle className="text-3xl">{data.shipmentCount}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Grouped by warehouse
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Shipping score</CardDescription>
              <CardTitle className="text-3xl">{data.shippingScore.toFixed(1)}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              A comparison score, not a charge
            </CardContent>
          </Card>
        </div>
      )}
      {notice && (
        <Alert variant={failed ? "destructive" : "default"}>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      {data.backorders.length > 0 && (
        <Alert>
          <PackageCheck />
          <AlertTitle>{stillNeededLabel(remainingUnits)}</AlertTitle>
          <AlertDescription>
            <div className="space-y-3">
              <p>
                Consolidate remaining backorder reserves leftover units from available stock at each
                warehouse. Receive stock on Inventory first. This does not ship.
              </p>
              {data.backorders.map((line) => {
                const ordered = data.order.lines
                  .filter((orderLine) => orderLine.productId === line.productId)
                  .reduce((sum, orderLine) => sum + orderLine.quantity, 0);
                const locations = warehouseAvailability(
                  line.productId,
                  workspaceData.warehouses,
                  workspaceData.stocks,
                );
                return (
                  <div key={line.productId} className="space-y-1">
                    <p>{stillNeededLine(line.product, line.quantity, ordered)}</p>
                    {locations.length === 0 ? (
                      <p className="text-sm">{NO_STOCK_AVAILABLE}</p>
                    ) : (
                      <ul className="text-sm">
                        {locations.map((location) => (
                          <li key={location.warehouseId}>
                            {location.name}: {location.available} available
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
              {canConsolidate && actions.consolidate && (
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
          <CardTitle>Reserved stock</CardTitle>
          <CardDescription>
            Confirmation holds stock. Accept shipment, then Ship. Override is only after accept, and
            never after fulfilled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {compact ? (
            <table className="w-full text-sm">
              <caption className="sr-only">Reserved stock</caption>
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-1.5 font-medium">Product</th>
                  <th className="py-1.5 font-medium">Warehouse</th>
                  <th className="py-1.5 text-right font-medium">Allocated</th>
                  <th className="py-1.5 text-right font-medium">Shipped</th>
                  <th className="py-1.5 text-right font-medium">Ready</th>
                </tr>
              </thead>
              <tbody>
                {data.allocations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-3 text-muted-foreground">
                      No stock reserved yet. Receive stock, then fill the remaining backorder.
                    </td>
                  </tr>
                ) : (
                  data.allocations.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-1.5">{row.product}</td>
                      <td className="py-1.5">{row.warehouse}</td>
                      <td className="py-1.5 text-right">{row.quantity}</td>
                      <td className="py-1.5 text-right">{row.shipped}</td>
                      <td className="py-1.5 text-right">{row.quantity - row.shipped}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <DataTable
              columns={columns}
              data={data.allocations}
              getRowId={(row) => row.id}
              pageSize={20}
              emptyMessage="No stock reserved yet. Receive stock, then fill the remaining backorder."
            />
          )}
          {!compact && <div className="flex flex-wrap gap-2">{shipmentActions}</div>}
        </CardContent>
      </Card>
      {canOperate && actions.ship && (
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
                    if (pending) return;
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
    </div>
  );
  if (!compact)
    return (
      <>
        <PageHeader
          title={data.order.number}
          description="Review reserved stock, ship units, and fill backorders when stock arrives."
          actions={
            <Button variant="outline" onClick={back}>
              <ArrowLeft />
              All orders
            </Button>
          }
        />
        {body}
      </>
    );
  return (
    <>
      <DialogBody>{body}</DialogBody>
      <DialogFooter showCloseButton>{shipmentActions}</DialogFooter>
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
  const { mutate } = useSWRConfig();
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          void mutate(
            (key) => typeof key === "string" && key.startsWith("/api/v1/fulfillment/orders"),
          );
          onClose();
        }
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Status changes only when you click Accept shipment, Consolidate remaining backorder, or
            Ship.
          </DialogDescription>
        </DialogHeader>
        <FulfillmentDetail id={id} back={onClose} compact />
      </DialogContent>
    </Dialog>
  );
}
