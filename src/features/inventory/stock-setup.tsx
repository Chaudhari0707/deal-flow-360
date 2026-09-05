"use client";

import { useState } from "react";

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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Workspace } from "@/lib/domain/_types/workspace";
import { fetchJson } from "@/lib/swr/fetcher";

export function StockSetup({ workspace, refresh }: { workspace: Workspace; refresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>Configure stock</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a stock location</DialogTitle>
          <DialogDescription>
            Create a zero-balance stock record, then receive a delivery to increase on hand.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="stock-product">Stockable product</FieldLabel>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger id="stock-product" className="w-full">
                <SelectValue placeholder="Choose a product" />
              </SelectTrigger>
              <SelectContent>
                {workspace.products
                  .filter((p) => p.stockable)
                  .map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} · {product.variant}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="stock-warehouse">Warehouse</FieldLabel>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger id="stock-warehouse" className="w-full">
                <SelectValue placeholder="Choose a warehouse" />
              </SelectTrigger>
              <SelectContent>
                {workspace.warehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button
            disabled={pending || !warehouseId || !productId}
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                await fetchJson("/api/v1/inventory/stocks", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ productId, warehouseId }),
                });
                refresh();
                setOpen(false);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Unable to configure stock");
              } finally {
                setPending(false);
              }
            }}
          >
            Configure location
          </Button>
        </FieldGroup>
      </DialogContent>
    </Dialog>
  );
}
