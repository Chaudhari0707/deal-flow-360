"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import type { WarehouseRow } from "@/features/inventory/_types/ui";
import { fetchJson } from "@/lib/swr/fetcher";

export function WarehouseSettings({
  warehouse = { id: "", name: "", active: false, replenishmentThreshold: 5, shippingWeight: 100 },
  refresh,
}: {
  warehouse?: WarehouseRow;
  refresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const form = useForm({
    defaultValues: {
      active: warehouse.active,
      name: warehouse.name,
      replenishmentThreshold: warehouse.replenishmentThreshold,
      shippingWeight: warehouse.shippingWeight,
    },
    mode: "onChange",
    reValidateMode: "onChange",
    shouldFocusError: true,
  });
  const active = useWatch({ control: form.control, name: "active" });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        {warehouse.id ? `Configure ${warehouse.name}` : "Add warehouse"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Warehouse settings</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(async (values) => {
            setError("");
            try {
              await fetchJson(
                warehouse.id
                  ? `/api/v1/inventory/warehouses/${warehouse.id}`
                  : "/api/v1/inventory/warehouses",
                {
                  method: warehouse.id ? "PATCH" : "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(values),
                },
              );
              refresh();
              setOpen(false);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Unable to save warehouse");
            }
          })}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`name-${warehouse.id}`}>Warehouse name</FieldLabel>
              <Input
                id={`name-${warehouse.id}`}
                {...form.register("name", { required: "Enter a name", maxLength: 100 })}
              />
              <FieldError>{form.formState.errors.name?.message}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor={`weight-${warehouse.id}`}>Shipping score × 100</FieldLabel>
              <NumberInput
                id={`weight-${warehouse.id}`}
                {...form.register("shippingWeight", {
                  valueAsNumber: true,
                  min: 0,
                  max: 100000,
                  required: true,
                })}
              />
              <FieldError>
                {form.formState.errors.shippingWeight && "Use a whole number between 0 and 100000"}
              </FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor={`threshold-${warehouse.id}`}>
                Low-stock alert threshold
              </FieldLabel>
              <NumberInput
                id={`threshold-${warehouse.id}`}
                {...form.register("replenishmentThreshold", {
                  valueAsNumber: true,
                  min: 0,
                  max: 1000000,
                  required: true,
                })}
              />
              <FieldError>
                {form.formState.errors.replenishmentThreshold &&
                  "Use a whole number between 0 and 1000000"}
              </FieldError>
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                id={`active-${warehouse.id}`}
                checked={active}
                onCheckedChange={(value) =>
                  form.setValue("active", Boolean(value), { shouldDirty: true })
                }
              />
              <FieldLabel htmlFor={`active-${warehouse.id}`}>
                Available for new allocations
              </FieldLabel>
            </Field>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </FieldGroup>
          <DialogFooter showCloseButton={!form.formState.isSubmitting}>
            <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isValid}>
              Save warehouse
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
