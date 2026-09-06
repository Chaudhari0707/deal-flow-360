"use client";

import { useState } from "react";

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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fieldLabel } from "@/features/inventory/inventory-editorial";
import { apiClient, apiData } from "@/lib/api/client";
import type { Workspace } from "@/lib/domain/_types/workspace";

/**
 * Enabling a product at a warehouse is configuration, not a receipt: two quiet letterspaced
 * labels over the primitives' own square controls, the shared scrolling body and sticky footer.
 * The balance it creates is zero, so nothing here is phrased as a quantity.
 */

export function StockSetup({ workspace, refresh }: { workspace: Workspace; refresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const stockable = workspace.products.filter((product) => product.stockable);
  async function configure() {
    if (!productId || !warehouseId) return;
    setPending(true);
    setError("");
    try {
      apiData(await apiClient.api.v1.inventory.stocks.post({ productId, warehouseId }));
      refresh();
      setOpen(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to configure stock");
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) return;
        setError("");
        setProductId(null);
        setWarehouseId(null);
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>Configure stock</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a stock location</DialogTitle>
          <DialogDescription>
            Create a zero-balance stock record, then receive a delivery to increase on hand.
            Repeating this keeps an existing balance untouched.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="stock-product" className={fieldLabel}>
                Stockable product
              </FieldLabel>
              <Select
                value={productId}
                onValueChange={(value) => {
                  if (typeof value !== "string") return;
                  setProductId(value);
                  setError("");
                }}
              >
                <SelectTrigger id="stock-product" className="w-full">
                  <SelectValue placeholder="Choose a product" />
                </SelectTrigger>
                <SelectContent>
                  {stockable.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} · {product.variant}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="stock-warehouse" className={fieldLabel}>
                Warehouse
              </FieldLabel>
              <Select
                value={warehouseId}
                onValueChange={(value) => {
                  if (typeof value !== "string") return;
                  setWarehouseId(value);
                  setError("");
                }}
              >
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
          </FieldGroup>
        </DialogBody>
        <DialogFooter showCloseButton={!pending}>
          <Button
            disabled={pending || !productId || !warehouseId}
            onClick={() => {
              void configure();
            }}
          >
            Configure location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
