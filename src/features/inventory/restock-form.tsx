"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { StockRow } from "@/features/inventory/_types/ui";
import { fetchJson } from "@/lib/swr/fetcher";

export function RestockForm({ stock, refresh }: { stock: StockRow; refresh: () => void }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [operation, setOperation] = useState({ key: "", payload: "" });
  const form = useForm({
    defaultValues: { quantity: 8, reason: "Delivery received" },
    mode: "onChange",
    reValidateMode: "onChange",
    shouldFocusError: true,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Restock {stock.name}</CardTitle>
        <CardDescription>
          {stock.warehouse} · {stock.available} available · {stock.reserved} reserved. A receipt
          updates both live views.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit(async (values) => {
            setMessage("");
            const payload = JSON.stringify(values);
            const nextOperation =
              operation.payload === payload ? operation : { key: crypto.randomUUID(), payload };
            setOperation(nextOperation);
            try {
              await fetchJson("/api/v1/inventory/restock", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...values,
                  operationKey: nextOperation.key,
                  warehouseId: stock.warehouseId,
                  productId: stock.productId,
                }),
              });
              setOperation({ key: "", payload: "" });
              setError(false);
              setMessage("Stock received. Backorders can now be consolidated.");
              refresh();
            } catch (e) {
              setError(true);
              setMessage(e instanceof Error ? e.message : "Unable to restock");
            }
          })}
        >
          <FieldGroup className="sm:grid sm:grid-cols-3 sm:items-end">
            <Field>
              <FieldLabel htmlFor="restock-quantity">Quantity received</FieldLabel>
              <Input
                id="restock-quantity"
                type="number"
                {...form.register("quantity", {
                  valueAsNumber: true,
                  required: true,
                  min: 1,
                  max: 1000000,
                  validate: Number.isInteger,
                })}
              />
              <FieldError>
                {form.formState.errors.quantity && "Enter a whole quantity from 1 to 1000000"}
              </FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="restock-reason">Receipt note</FieldLabel>
              <Input
                id="restock-reason"
                {...form.register("reason", { required: true, minLength: 3, maxLength: 500 })}
              />
              <FieldError>
                {form.formState.errors.reason && "Add a note of 3–500 characters"}
              </FieldError>
            </Field>
            <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isValid}>
              Receive stock
            </Button>
          </FieldGroup>
        </form>
        {message && (
          <Alert className="mt-4" variant={error ? "destructive" : "default"}>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
