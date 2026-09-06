"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowLeft } from "lucide-react";
import useSWR, { useSWRConfig } from "swr";

import type { DataTableFeatures } from "@/components/ui/_types/data-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FulfillmentDetail as Detail } from "@/features/inventory/_types/ui";
import {
  fulfillmentActions,
  fulfillmentNextStep,
  NO_STOCK_AVAILABLE,
  remainingBackorderUnits,
  stillNeededLabel,
  stillNeededLine,
  warehouseAvailability,
} from "@/features/inventory/fulfillment-copy";
import {
  compactCell,
  compactHead,
  FigureBand,
  figureValue,
  numericCell,
  operationalTable,
  SectionHead,
  StatusMark,
} from "@/features/inventory/inventory-editorial";
import { OverrideForm } from "@/features/inventory/override-form";
import { PageHeader } from "@/features/shell/page-header";
import { useWorkspace } from "@/features/shell/use-workspace";
import { WorkspaceState } from "@/features/shell/workspace-state";
import { apiClient, apiData } from "@/lib/api/client";
import { cn } from "@/lib/utils";

/**
 * A dispatch dossier, not a stack of cards. Counts sit in a hairline-divided figure band, every
 * warehouse line is a ruled register row with right-aligned tabular numerals, and state reads as
 * a square marker plus an AAA ink. The same body serves the route and the dialog; only density
 * and heading level change.
 */

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
      {
        accessorKey: "product",
        header: "Product",
        cell: ({ row }) => (
          <span className="font-medium text-foreground">{row.original.product}</span>
        ),
      },
      {
        accessorKey: "warehouse",
        header: "Warehouse",
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.warehouse}</span>,
      },
      {
        accessorKey: "quantity",
        header: () => <span className="block text-right">Allocated</span>,
        cell: ({ row }) => (
          <span className={cn(numericCell, "text-foreground")}>{row.original.quantity}</span>
        ),
      },
      {
        accessorKey: "shipped",
        header: () => <span className="block text-right">Shipped</span>,
        cell: ({ row }) => (
          <span className={cn(numericCell, "text-muted-foreground")}>{row.original.shipped}</span>
        ),
      },
      {
        id: "pending",
        header: () => <span className="block text-right">Ready to ship</span>,
        cell: ({ row }) => (
          <span className={cn(numericCell, "font-medium text-foreground")}>
            {row.original.quantity - row.original.shipped}
          </span>
        ),
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
  const level = compact ? "h3" : "h2";
  const statusFigure = <StatusMark prominent status={data.order.fulfillmentStatus} />;
  const figures = compact
    ? [
        { label: "Status", value: statusFigure },
        { label: "Still needed", value: <span className={figureValue}>{remainingUnits}</span> },
        {
          label: "Pending shipments",
          value: <span className={figureValue}>{data.shipmentCount}</span>,
        },
      ]
    : [
        {
          label: "Status",
          note: data.order.acceptedAt
            ? "Shipment accepted by operations"
            : "Awaiting operations acceptance",
          value: statusFigure,
        },
        {
          label: "Pending shipments",
          note: "Grouped by warehouse",
          value: <span className={figureValue}>{data.shipmentCount}</span>,
        },
        {
          label: "Shipping score",
          note: "A comparison score, not a charge",
          value: <span className={figureValue}>{data.shippingScore.toFixed(1)}</span>,
        },
      ];
  const hasShipmentActions = canOperate && (actions.accept || actions.override);
  const shipmentActions = canOperate ? (
    <>
      {actions.accept && (
        <Button disabled={pending} onClick={() => void action("accept")}>
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
    <div className={compact ? "grid gap-6" : "grid gap-10"}>
      <div className="grid gap-6">
        {nextStep && (
          <p className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">{nextStep}</p>
        )}
        <FigureBand compact={compact} items={figures} />
      </div>
      {notice && (
        <Alert variant={failed ? "destructive" : "default"}>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      {data.backorders.length > 0 && (
        <Alert>
          <AlertTitle>{stillNeededLabel(remainingUnits)}</AlertTitle>
          <AlertDescription>
            <p className="max-w-[68ch] leading-relaxed">
              Consolidate remaining backorder reserves leftover units from available stock at each
              warehouse. Receive stock on Inventory first. This does not ship.
            </p>
            <dl>
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
                  <div key={line.productId} className="border-t border-border py-3">
                    <dt className="flex items-baseline gap-2.5 text-sm text-ink-risk">
                      <span aria-hidden className="size-1.5 shrink-0 translate-y-1 bg-ink-risk" />
                      {stillNeededLine(line.product, line.quantity, ordered)}
                    </dt>
                    {locations.length === 0 ? (
                      <dd className="mt-1.5 pl-4 text-xs text-muted-foreground">
                        {NO_STOCK_AVAILABLE}
                      </dd>
                    ) : (
                      locations.map((location) => (
                        <dd
                          key={location.warehouseId}
                          className="mt-1.5 pl-4 text-xs text-muted-foreground tabular-nums"
                        >
                          {location.name}: {location.available} available
                        </dd>
                      ))
                    )}
                  </div>
                );
              })}
            </dl>
            {canConsolidate && actions.consolidate && (
              <Button
                className="mt-5"
                disabled={pending}
                onClick={() => void action("consolidate")}
              >
                Consolidate remaining backorder
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
      <section>
        <SectionHead
          level={level}
          title="Reserved stock"
          description="Confirmation holds stock. Accept shipment, then Ship. Override is only after accept, and never after fulfilled."
        />
        {compact ? (
          <Table className="mt-5 text-[0.8125rem]">
            <TableCaption className="sr-only">Reserved stock</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className={compactHead}>Product</TableHead>
                <TableHead className={compactHead}>Warehouse</TableHead>
                <TableHead className={cn(compactHead, "text-right")}>Allocated</TableHead>
                <TableHead className={cn(compactHead, "text-right")}>Shipped</TableHead>
                <TableHead className={cn(compactHead, "text-right")}>Ready</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.allocations.filter((row) => row.quantity > 0).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className={cn(compactCell, "text-muted-foreground")}>
                    No stock reserved yet. Receive stock, then fill the remaining backorder.
                  </TableCell>
                </TableRow>
              ) : (
                data.allocations
                  .filter((row) => row.quantity > 0)
                  .map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className={cn(compactCell, "font-medium text-foreground")}>
                        {row.product}
                      </TableCell>
                      <TableCell className={cn(compactCell, "text-muted-foreground")}>
                        {row.warehouse}
                      </TableCell>
                      <TableCell className={cn(compactCell, "text-right text-foreground")}>
                        {row.quantity}
                      </TableCell>
                      <TableCell className={cn(compactCell, "text-right text-muted-foreground")}>
                        {row.shipped}
                      </TableCell>
                      <TableCell
                        className={cn(compactCell, "text-right font-medium text-foreground")}
                      >
                        {row.quantity - row.shipped}
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        ) : (
          <div className="mt-5">
            <DataTable
              classNames={operationalTable}
              columns={columns}
              data={data.allocations.filter((row) => row.quantity > 0)}
              enableColumnResizing={false}
              getRowId={(row) => row.id}
              pageSize={20}
              emptyMessage="No stock reserved yet. Receive stock, then fill the remaining backorder."
            />
          </div>
        )}
        {!compact && hasShipmentActions && (
          <div className="mt-6 flex flex-wrap gap-3">{shipmentActions}</div>
        )}
      </section>
      {canOperate && actions.ship && (
        <section>
          <SectionHead
            level={level}
            title="Dispatch reserved units"
            description="Each action ships the remaining allocation. Repeated requests cannot dispatch twice."
          />
          <div className="mt-5 flex flex-wrap gap-3">
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
                  Ship {allocation.quantity - allocation.shipped} {allocation.product} ·{" "}
                  {allocation.warehouse}
                </Button>
              ))}
          </div>
        </section>
      )}
    </div>
  );
  if (!compact)
    return (
      <div className="w-full">
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
        <div className="mt-10">{body}</div>
      </div>
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
