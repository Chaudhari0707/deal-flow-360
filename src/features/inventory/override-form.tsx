"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FulfillmentDetail } from "@/features/inventory/_types/ui";
import { fieldLabel } from "@/features/inventory/inventory-editorial";
import {
  allocatedQuantity,
  clampOverrideQuantity,
  defaultOverrideRows,
  overrideAllocations,
  quantityMax,
  remainingForRow,
  rowQuantityError,
  rowWarehouseError,
  stockableProducts,
  warehouseAlreadyChosen,
  warehouseAvailable,
} from "@/features/inventory/override-form-state";
import { apiClient, apiData } from "@/lib/api/client";
import type { Workspace } from "@/lib/domain/_types/workspace";
import { cn } from "@/lib/utils";

/**
 * An audited re-plan, laid out as a ledger: the running demand/allocated/remaining counts sit
 * tabular under a rule so they compare line to line, and every extra warehouse row sits under
 * its own hairline instead of inside a nested card.
 */

export function OverrideForm({
  detail,
  workspace,
  refresh,
}: {
  detail: FulfillmentDetail;
  workspace: Workspace;
  refresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const products = stockableProducts(detail.order.lines);
  const warehouses = workspace.warehouses.filter((warehouse) => warehouse.active);
  const form = useForm({
    defaultValues: {
      allocations: defaultOverrideRows(products, detail.allocations),
      reason: "",
    },
    mode: "onChange",
    reValidateMode: "onChange",
    shouldFocusError: true,
  });
  const { append, fields, remove } = useFieldArray({ control: form.control, name: "allocations" });
  const watched = useWatch({ control: form.control, name: "allocations" }) ?? [];
  const allocations = fields.map((field, index) => watched[index] ?? field);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>Manual override</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Adjust warehouse allocations</DialogTitle>
          <DialogDescription>
            Choose a warehouse to see available stock, then enter a quantity. Add another warehouse
            until the line is filled, or leave the rest as backorder. Only unshipped units move;
            other orders stay protected. Removing a row releases that allocation.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(async (values) => {
            setError("");
            try {
              apiData(
                await apiClient.api.v1.fulfillment({ id: detail.order.id }).override.post({
                  allocations: overrideAllocations(values.allocations),
                  reason: values.reason,
                }),
              );
              refresh();
              setOpen(false);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Stock changed. Refresh and try again.");
            }
          })}
        >
          <DialogBody>
            <FieldGroup>
              {products.map((product) => {
                const productAllocations = detail.allocations.filter(
                  (line) => line.productId === product.productId,
                );
                const shipped = productAllocations.reduce((sum, line) => sum + line.shipped, 0);
                const unshippedDemand = Math.max(0, product.quantity - shipped);
                const productEntries = fields
                  .map((field, index) => ({ field, index }))
                  .filter((entry) => entry.field.productId === product.productId);
                const productRows = productEntries.map(
                  (entry) => allocations[entry.index] ?? entry.field,
                );
                const allocated = allocatedQuantity(productRows);
                const remaining = Math.max(0, unshippedDemand - allocated);
                const chosen = new Set(
                  productRows.map((row) => row.warehouseId).filter((id) => id),
                );
                const hasOpenRow = productRows.some((row) => !row.warehouseId);
                return (
                  <FieldSet key={product.productId}>
                    <FieldLegend>{product.name}</FieldLegend>
                    <FieldDescription
                      aria-live="polite"
                      className="border-b border-border pb-3 tabular-nums"
                    >
                      Demanded {product.quantity} · Allocated {allocated} · Remaining {remaining}
                      {shipped > 0 ? ` · ${shipped} shipped stay in place` : ""}
                    </FieldDescription>
                    {productEntries.map(({ field, index }, rowNumber) => {
                      const row = allocations[index] ?? field;
                      const warehouseId = row.warehouseId;
                      const available = warehouseAvailable(
                        product.productId,
                        warehouseId,
                        workspace.stocks,
                        detail.allocations,
                      );
                      const rowRemaining = remainingForRow(
                        unshippedDemand,
                        allocations,
                        product.productId,
                        index,
                      );
                      const max = quantityMax(available, rowRemaining);
                      const warehouseError =
                        form.formState.errors.allocations?.[index]?.warehouseId;
                      const quantityError = form.formState.errors.allocations?.[index]?.quantity;
                      const warehouseName =
                        warehouses.find((warehouse) => warehouse.id === warehouseId)?.name ??
                        "warehouse";
                      const rowError = warehouseError?.message ?? quantityError?.message;
                      form.register(`allocations.${index}.warehouseId`, {
                        validate: (value) =>
                          rowWarehouseError({
                            quantity: form.getValues(`allocations.${index}.quantity`),
                            taken: warehouseAlreadyChosen(
                              form.getValues("allocations"),
                              product.productId,
                              value,
                              index,
                            ),
                            warehouseId: value,
                          }) ?? true,
                      });
                      form.register(`allocations.${index}.quantity`, {
                        valueAsNumber: true,
                        validate: (value) => {
                          const rows = form.getValues("allocations");
                          return (
                            rowQuantityError({
                              available: warehouseAvailable(
                                product.productId,
                                rows[index]?.warehouseId ?? "",
                                workspace.stocks,
                                detail.allocations,
                              ),
                              quantity: value,
                              remaining: remainingForRow(
                                unshippedDemand,
                                rows,
                                product.productId,
                                index,
                              ),
                              warehouseId: rows[index]?.warehouseId ?? "",
                            }) ?? true
                          );
                        },
                      });
                      return (
                        <div
                          key={field.id}
                          className={cn(
                            "grid gap-2",
                            rowNumber > 0 && "border-t border-border pt-4",
                          )}
                        >
                          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end">
                            <Field data-invalid={Boolean(warehouseError) || undefined}>
                              <FieldLabel
                                htmlFor={`override-warehouse-${field.id}`}
                                className={fieldLabel}
                              >
                                Warehouse
                              </FieldLabel>
                              <Select
                                value={warehouseId || null}
                                onValueChange={(value) => {
                                  if (!value) return;
                                  const nextAvailable = warehouseAvailable(
                                    product.productId,
                                    value,
                                    workspace.stocks,
                                    detail.allocations,
                                  );
                                  const nextMax = quantityMax(
                                    nextAvailable,
                                    remainingForRow(
                                      unshippedDemand,
                                      form.getValues("allocations"),
                                      product.productId,
                                      index,
                                    ),
                                  );
                                  form.setValue(`allocations.${index}.warehouseId`, value, {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                  });
                                  form.setValue(
                                    `allocations.${index}.quantity`,
                                    clampOverrideQuantity(
                                      form.getValues(`allocations.${index}.quantity`),
                                      nextMax,
                                    ),
                                    { shouldDirty: true, shouldValidate: true },
                                  );
                                  void form.trigger();
                                }}
                              >
                                <SelectTrigger
                                  id={`override-warehouse-${field.id}`}
                                  className="w-full"
                                  aria-invalid={Boolean(warehouseError) || undefined}
                                  aria-label={`${product.name} warehouse ${rowNumber + 1}`}
                                >
                                  <SelectValue placeholder="Choose a warehouse" />
                                </SelectTrigger>
                                <SelectContent>
                                  {warehouses.map((warehouse) => (
                                    <SelectItem
                                      key={warehouse.id}
                                      value={warehouse.id}
                                      disabled={
                                        warehouse.id !== warehouseId && chosen.has(warehouse.id)
                                      }
                                    >
                                      {warehouse.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Field>
                            {warehouseId ? (
                              <Field data-invalid={Boolean(quantityError) || undefined}>
                                <FieldLabel
                                  htmlFor={`override-qty-${field.id}`}
                                  className={fieldLabel}
                                >
                                  Quantity
                                </FieldLabel>
                                <NumberInput
                                  id={`override-qty-${field.id}`}
                                  aria-invalid={Boolean(quantityError) || undefined}
                                  aria-describedby={
                                    rowError ? `override-row-error-${field.id}` : undefined
                                  }
                                  aria-label={`${product.name} quantity at ${warehouseName}`}
                                  min={1}
                                  max={max || undefined}
                                  value={
                                    Number.isSafeInteger(row.quantity) && row.quantity > 0
                                      ? row.quantity
                                      : null
                                  }
                                  onValueChange={(value) => {
                                    form.setValue(`allocations.${index}.quantity`, value ?? 0, {
                                      shouldDirty: true,
                                      shouldValidate: true,
                                    });
                                  }}
                                />
                              </Field>
                            ) : (
                              <div />
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Remove ${warehouseName} from ${product.name}`}
                              onClick={() => {
                                remove(index);
                                void form.trigger();
                              }}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                          {warehouseId ? (
                            <FieldDescription aria-live="polite" className="tabular-nums">
                              Available {available} at {warehouseName}
                            </FieldDescription>
                          ) : null}
                          {rowError ? (
                            <FieldError id={`override-row-error-${field.id}`}>
                              {rowError}
                            </FieldError>
                          ) : null}
                        </div>
                      );
                    })}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={remaining <= 0 || chosen.size >= warehouses.length || hasOpenRow}
                      aria-label={`Add warehouse for ${product.name}`}
                      onClick={() =>
                        append({ productId: product.productId, quantity: 0, warehouseId: "" })
                      }
                    >
                      <Plus />
                      Add warehouse
                    </Button>
                  </FieldSet>
                );
              })}
              <Field className="border-t border-border-strong pt-4">
                <FieldLabel htmlFor="override-reason" className={fieldLabel}>
                  Why is this change needed?
                </FieldLabel>
                <Input
                  id="override-reason"
                  {...form.register("reason", {
                    required: "Add a short reason for this change.",
                    minLength: { value: 3, message: "Use at least 3 characters." },
                    maxLength: { value: 500, message: "Keep the reason under 500 characters." },
                  })}
                />
                <FieldError>{form.formState.errors.reason?.message}</FieldError>
              </Field>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </FieldGroup>
          </DialogBody>
          <DialogFooter showCloseButton={!form.formState.isSubmitting}>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Save audited override
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
