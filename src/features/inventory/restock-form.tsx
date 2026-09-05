"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { integerFieldMessage } from "@/components/ui/number-input-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StockRow } from "@/features/inventory/_types/ui";
import { restockLocations } from "@/features/inventory/restock-locations";
import { apiClient, apiData } from "@/lib/api/client";
import type { Workspace } from "@/lib/domain/_types/workspace";

export function RestockDialog({
  stock,
  refresh,
  open,
  onOpenChange,
  locations,
}: {
  stock: StockRow;
  refresh: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations?: StockRow[];
}) {
  const options = locations?.length ? locations : [stock];
  const [warehouseId, setWarehouseId] = useState(stock.warehouseId);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [operation, setOperation] = useState({ key: "", payload: "" });
  const current = options.find((row) => row.warehouseId === warehouseId) ?? options[0] ?? stock;
  const form = useForm({
    defaultValues: { quantity: 8, reason: "Delivery received" },
    mode: "onChange",
    reValidateMode: "onChange",
    shouldFocusError: true,
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Restock {current.name} at {current.warehouse}
          </DialogTitle>
          <DialogDescription>
            On hand {current.onHand}, reserved {current.reserved}, available {current.available}.
            {current.available === 0
              ? " Sold-out SKUs can still be received."
              : " A receipt updates live inventory and fulfillment."}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(async (values) => {
            setMessage("");
            const payload = JSON.stringify({ ...values, warehouseId: current.warehouseId });
            const nextOperation =
              operation.payload === payload ? operation : { key: crypto.randomUUID(), payload };
            setOperation(nextOperation);
            try {
              apiData(
                await apiClient.api.v1.inventory.restock.post({
                  ...values,
                  operationKey: nextOperation.key,
                  warehouseId: current.warehouseId,
                  productId: current.productId,
                }),
              );
              setOperation({ key: "", payload: "" });
              setError(false);
              refresh();
              onOpenChange(false);
            } catch (e) {
              setError(true);
              setMessage(e instanceof Error ? e.message : "Unable to restock");
            }
          })}
        >
          <DialogBody>
            <FieldGroup
              className={options.length > 1 ? undefined : "sm:grid sm:grid-cols-2 sm:items-end"}
            >
              {options.length > 1 ? (
                <Field>
                  <FieldLabel htmlFor="restock-warehouse">Warehouse</FieldLabel>
                  <Select
                    value={current.warehouseId}
                    onValueChange={(value) => {
                      if (typeof value !== "string") return;
                      setWarehouseId(value);
                      setMessage("");
                    }}
                  >
                    <SelectTrigger id="restock-warehouse" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((row) => (
                        <SelectItem key={row.warehouseId} value={row.warehouseId}>
                          {row.warehouse} · on hand {row.onHand} · available {row.available}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : (
                <Field>
                  <FieldLabel htmlFor="restock-warehouse">Warehouse</FieldLabel>
                  <Input id="restock-warehouse" readOnly value={current.warehouse} />
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="restock-quantity">Quantity received</FieldLabel>
                <NumberInput
                  id="restock-quantity"
                  min={1}
                  max={1000000}
                  step={1}
                  {...form.register("quantity", {
                    valueAsNumber: true,
                    required: "Enter how many units you received.",
                    validate: (value) =>
                      integerFieldMessage(value, 1, 1_000_000, "quantity") ?? true,
                  })}
                />
                <FieldError>{form.formState.errors.quantity?.message}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="restock-reason">Receipt note</FieldLabel>
                <Input
                  id="restock-reason"
                  {...form.register("reason", {
                    required: "Add a short receipt note.",
                    minLength: { value: 3, message: "Use at least 3 characters." },
                    maxLength: { value: 500, message: "Keep the note under 500 characters." },
                  })}
                />
                <FieldError>{form.formState.errors.reason?.message}</FieldError>
              </Field>
            </FieldGroup>
            {message && (
              <Alert className="mt-4" variant={error ? "destructive" : "default"}>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}
          </DialogBody>
          <DialogFooter showCloseButton={!form.formState.isSubmitting}>
            <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isValid}>
              Receive stock
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BackorderRestock({
  product,
  productId,
  refresh,
  workspace,
}: {
  product: string;
  productId: string;
  refresh: () => void;
  workspace: Workspace;
}) {
  const [open, setOpen] = useState(false);
  const locations = restockLocations(workspace, productId);
  const stock = locations[0];
  if (!stock)
    return <p className="text-sm">Configure {product} at a warehouse before receiving stock.</p>;
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Restock {product}
      </Button>
      <RestockDialog
        key={productId}
        locations={locations}
        onOpenChange={setOpen}
        open={open}
        refresh={refresh}
        stock={stock}
      />
    </>
  );
}
