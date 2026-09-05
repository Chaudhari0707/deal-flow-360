"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { FulfillmentDetail } from "@/features/inventory/_types/ui";
import type { Workspace } from "@/lib/domain/_types/workspace";
import { fetchJson } from "@/lib/swr/fetcher";

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
  const products = [
    ...new Map(
      detail.order.lines.filter((l) => l.stockable).map((line) => [line.productId, line]),
    ).values(),
  ];
  const rows = products.flatMap((product) =>
    workspace.warehouses
      .filter((w) => w.active)
      .map((warehouse) => {
        const allocation = detail.allocations.find(
          (a) => a.productId === product.productId && a.warehouseId === warehouse.id,
        );
        const balance = workspace.stocks.find(
          (s) => s.productId === product.productId && s.warehouseId === warehouse.id,
        );
        const quantity = allocation ? allocation.quantity - allocation.shipped : 0;
        return {
          available: (balance ? balance.onHand - balance.reserved : 0) + quantity,
          label: `${product.name} · ${warehouse.name}`,
          productId: product.productId,
          quantity,
          warehouseId: warehouse.id,
        };
      }),
  );
  const form = useForm({
    defaultValues: {
      allocations: rows.map(({ productId, quantity, warehouseId }) => ({
        productId,
        quantity,
        warehouseId,
      })),
      reason: "",
    },
    mode: "onChange",
    reValidateMode: "onChange",
    shouldFocusError: true,
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>Manual override</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adjust warehouse allocations</DialogTitle>
          <DialogDescription>
            Only unshipped units move. Your order's reservations are reusable; other orders remain
            protected. Zero releases this allocation.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(async (values) => {
            setError("");
            try {
              await fetchJson(`/api/v1/fulfillment/${detail.order.id}/override`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...values,
                  allocations: values.allocations.filter((a) => a.quantity > 0),
                }),
              });
              refresh();
              setOpen(false);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Stock changed. Refresh and try again.");
            }
          })}
        >
          <FieldGroup>
            {rows.map((row, index) => (
              <Field key={`${row.productId}-${row.warehouseId}`}>
                <FieldLabel htmlFor={`allocation-${index}`}>
                  {row.label} · up to {row.available}
                </FieldLabel>
                <Input
                  id={`allocation-${index}`}
                  type="number"
                  {...form.register(`allocations.${index}.quantity`, {
                    valueAsNumber: true,
                    required: true,
                    min: 0,
                    max: row.available,
                    validate: Number.isInteger,
                  })}
                />
                <FieldError>
                  {form.formState.errors.allocations?.[index]?.quantity &&
                    `Enter a whole quantity from 0 to ${row.available}`}
                </FieldError>
              </Field>
            ))}
            <Field>
              <FieldLabel htmlFor="override-reason">Why is this change needed?</FieldLabel>
              <Input
                id="override-reason"
                {...form.register("reason", { required: true, minLength: 3, maxLength: 500 })}
              />
              <FieldError>
                {form.formState.errors.reason && "Enter a reason of at least 3 characters"}
              </FieldError>
            </Field>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={!form.formState.isValid || form.formState.isSubmitting}>
              Save audited override
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
