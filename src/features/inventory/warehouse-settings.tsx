"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { integerFieldMessage } from "@/components/ui/number-input-utils";
import type { WarehouseRow } from "@/features/inventory/_types/ui";
import {
  ACTIVE_WAREHOUSE_LIMIT_MESSAGE,
  wouldExceedActiveWarehouseLimit,
} from "@/features/inventory/warehouse-limits";
import { apiClient, apiData } from "@/lib/api/client";

export function WarehouseSettings({
  warehouse = { id: "", name: "", active: false, replenishmentThreshold: 5, shippingWeight: 100 },
  warehouses,
  refresh,
}: {
  warehouse?: WarehouseRow;
  warehouses: WarehouseRow[];
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
  const blocked = wouldExceedActiveWarehouseLimit(warehouses, warehouse.id, Boolean(active));
  const conflictId = `warehouse-active-limit-${warehouse.id || "new"}`;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) return;
        setError("");
        form.reset({
          active: warehouse.active,
          name: warehouse.name,
          replenishmentThreshold: warehouse.replenishmentThreshold,
          shippingWeight: warehouse.shippingWeight,
        });
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        {warehouse.id ? `Configure` : "Add warehouse"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Warehouse settings</DialogTitle>
          <DialogDescription>
            At most three warehouses can be active. Pause one before activating another.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(async (values) => {
            setError("");
            try {
              const endpoint = apiClient.api.v1.inventory.warehouses;
              if (warehouse.id) apiData(await endpoint({ id: warehouse.id }).patch(values));
              else apiData(await endpoint.post(values));
              refresh();
              setOpen(false);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Unable to save warehouse");
            }
          })}
        >
          <DialogBody>
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
                <FieldLabel htmlFor={`weight-${warehouse.id}`}>Shipping score</FieldLabel>
                <FieldDescription>
                  Used when stock is split across warehouses. Higher scores ship later.
                </FieldDescription>
                <NumberInput
                  id={`weight-${warehouse.id}`}
                  min={0}
                  max={100000}
                  step={1}
                  {...form.register("shippingWeight", {
                    valueAsNumber: true,
                    required: "Enter a shipping score.",
                    validate: (value) =>
                      integerFieldMessage(value, 0, 100_000, "shipping score") ?? true,
                  })}
                />
                <FieldError>{form.formState.errors.shippingWeight?.message}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor={`threshold-${warehouse.id}`}>
                  Low-stock alert threshold
                </FieldLabel>
                <NumberInput
                  id={`threshold-${warehouse.id}`}
                  min={0}
                  max={1000000}
                  step={1}
                  {...form.register("replenishmentThreshold", {
                    valueAsNumber: true,
                    required: "Enter a low-stock threshold.",
                    validate: (value) =>
                      integerFieldMessage(value, 0, 1_000_000, "threshold") ?? true,
                  })}
                />
                <FieldError>{form.formState.errors.replenishmentThreshold?.message}</FieldError>
              </Field>
              <Field orientation="horizontal">
                <Checkbox
                  id={`active-${warehouse.id}`}
                  aria-describedby={blocked ? conflictId : undefined}
                  checked={active}
                  onCheckedChange={(value) =>
                    form.setValue("active", Boolean(value), { shouldDirty: true })
                  }
                />
                <FieldLabel htmlFor={`active-${warehouse.id}`}>
                  Available for new allocations
                </FieldLabel>
              </Field>
              {blocked && (
                <Alert>
                  <AlertDescription id={conflictId}>
                    {ACTIVE_WAREHOUSE_LIMIT_MESSAGE}
                  </AlertDescription>
                </Alert>
              )}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </FieldGroup>
          </DialogBody>
          <DialogFooter showCloseButton={!form.formState.isSubmitting}>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting || !form.formState.isValid || blocked}
            >
              Save warehouse
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
