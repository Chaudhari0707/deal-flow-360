"use client";

import { type FormEvent, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/features/shell/use-workspace";
import { apiClient, apiData, HttpResponseError } from "@/lib/api/client";
import type { Workspace } from "@/lib/domain/_types/workspace";

function productCategory(value: string): "Hardware" | "Services" | "Subscription" {
  if (value === "Hardware" || value === "Services" || value === "Subscription") return value;
  throw new Error("Choose a valid product category");
}

function intervalMonths(value: number): 0 | 1 | 3 | 12 {
  if (value === 0 || value === 1 || value === 3 || value === 12) return value;
  throw new Error("Choose a valid billing interval");
}

function customerTier(value: string): "Bronze" | "Gold" | "Silver" {
  if (value === "Bronze" || value === "Silver" || value === "Gold") return value;
  throw new Error("Choose a valid customer tier");
}

export function CatalogEditor({
  kind,
  product,
  customer,
  close,
  saved,
}: {
  kind: "product" | "customer";
  product?: Workspace["products"][number];
  customer?: Workspace["customers"][number];
  close: () => void;
  saved: () => Promise<unknown>;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [stockable, setStockable] = useState(product?.stockable ?? false);
  const [active, setActive] = useState(product?.active ?? true);
  const [promoted, setPromoted] = useState(product?.promoted ?? false);
  const [pairedProductIds, setPairedProductIds] = useState(
    () => product?.pairedProductIds.filter((id) => id !== product.id) ?? [],
  );
  const { data } = useWorkspace();
  const pairingChoices = data?.products.filter((candidate) => candidate.id !== product?.id) ?? [];
  const existing = kind === "product" ? product : customer;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    const numeric = (name: string, scale = 1) => Math.round(Number(value(name)) * scale);
    if (kind === "product" && stockable && numeric("interval") > 0) {
      setError("Recurring subscriptions cannot track warehouse inventory.");
      return;
    }
    setPending(true);
    setError("");
    try {
      if (kind === "product") {
        const body = {
          name: value("name"),
          category: productCategory(value("category")),
          description: value("description"),
          unit: value("unit"),
          variant: value("variant"),
          priceCents: numeric("price", 100),
          costCents: numeric("cost", 100),
          taxBps: numeric("tax", 100),
          intervalMonths: intervalMonths(numeric("interval")),
          promotionBps: numeric("promotion", 100),
          pairedProductIds,
          stockable,
          active,
          promoted,
        };
        const products = apiClient.api.v1.catalog.products;
        if (product) apiData(await products({ id: product.id }).patch(body));
        else apiData(await products.post(body));
      } else {
        const body = {
          name: value("name"),
          email: value("email"),
          tier: customerTier(value("tier")),
          team: value("team"),
        };
        const customers = apiClient.api.v1.customers;
        if (customer) apiData(await customers({ id: customer.id }).patch(body));
        else apiData(await customers.post(body));
      }
      await saved();
      close();
    } catch (failure) {
      setError(
        failure instanceof HttpResponseError && failure.status === 403
          ? "Your role cannot change this catalog."
          : "Could not save. Check the field values and try again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) close();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {existing ? "Edit" : "Add"} {kind}
          </DialogTitle>
          <DialogDescription>
            {kind === "product"
              ? "Each variant is a separate SKU with its own final unit price. Catalog changes apply to new quotation lines; existing quotes keep their pricing snapshots."
              : "Manage the customer details used for quotations and billing."}
          </DialogDescription>
        </DialogHeader>
        <form method="post" onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="catalog-name">Name</FieldLabel>
              <Input
                id="catalog-name"
                name="name"
                required
                maxLength={120}
                defaultValue={existing?.name}
              />
            </Field>
            {kind === "customer" ? (
              <>
                <Field>
                  <FieldLabel htmlFor="catalog-email">Customer email</FieldLabel>
                  <Input
                    id="catalog-email"
                    name="email"
                    type="email"
                    required
                    maxLength={254}
                    defaultValue={customer?.email}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="catalog-tier">Tier</FieldLabel>
                    <Select name="tier" defaultValue={customer?.tier ?? "Bronze"}>
                      <SelectTrigger id="catalog-tier" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["Bronze", "Silver", "Gold"].map((tier) => (
                          <SelectItem key={tier} value={tier}>
                            {tier}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="catalog-team">Sales team</FieldLabel>
                    <Input
                      id="catalog-team"
                      name="team"
                      required
                      maxLength={100}
                      defaultValue={customer?.team ?? "Enterprise"}
                    />
                  </Field>
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="catalog-category">Category</FieldLabel>
                    <Select name="category" defaultValue={product?.category ?? "Hardware"}>
                      <SelectTrigger id="catalog-category" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["Hardware", "Services", "Subscription"].map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="catalog-variant">Variant</FieldLabel>
                    <Input
                      id="catalog-variant"
                      name="variant"
                      required
                      maxLength={100}
                      defaultValue={product?.variant ?? "Standard"}
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="catalog-description">Description</FieldLabel>
                  <Textarea
                    id="catalog-description"
                    name="description"
                    maxLength={2000}
                    defaultValue={product?.description}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {[
                    {
                      name: "price",
                      label: "Unit price ($)",
                      value: (product?.priceCents ?? 0) / 100,
                      step: "0.01",
                      max: 100000,
                    },
                    {
                      name: "cost",
                      label: "Unit cost ($)",
                      value: (product?.costCents ?? 0) / 100,
                      step: "0.01",
                      max: 100000,
                    },
                    {
                      name: "tax",
                      label: "Tax (%)",
                      value: (product?.taxBps ?? 0) / 100,
                      step: "0.01",
                      max: 100,
                    },
                    {
                      name: "promotion",
                      label: "Promotion discount (%)",
                      value: (product?.promotionBps ?? 0) / 100,
                      step: "0.01",
                      max: 100,
                    },
                  ].map((field) => (
                    <Field key={field.name}>
                      <FieldLabel htmlFor={`catalog-${field.name}`}>{field.label}</FieldLabel>
                      <NumberInput
                        id={`catalog-${field.name}`}
                        name={field.name}
                        required
                        min="0"
                        max={field.max}
                        step={field.step}
                        defaultValue={field.value}
                      />
                    </Field>
                  ))}
                  <Field>
                    <FieldLabel htmlFor="catalog-interval">Billing interval</FieldLabel>
                    <Select name="interval" defaultValue={String(product?.intervalMonths ?? 0)}>
                      <SelectTrigger id="catalog-interval" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          { value: "0", label: "One-time" },
                          { value: "1", label: "Monthly" },
                          { value: "3", label: "Quarterly" },
                          { value: "12", label: "Yearly" },
                        ].map((interval) => (
                          <SelectItem key={interval.value} value={interval.value}>
                            {interval.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="catalog-unit">Unit</FieldLabel>
                    <Input
                      id="catalog-unit"
                      name="unit"
                      required
                      maxLength={50}
                      defaultValue={product?.unit ?? "unit"}
                    />
                  </Field>
                </div>
                <FieldSet>
                  <FieldLegend>Suggested pairings</FieldLegend>
                  <FieldDescription>
                    Optionally choose up to 20 products to recommend alongside this item.
                  </FieldDescription>
                  <FieldGroup className="max-h-48 gap-3 overflow-y-auto rounded-lg border p-3">
                    {pairingChoices.map((candidate) => {
                      const checked = pairedProductIds.includes(candidate.id);
                      return (
                        <Field key={candidate.id} orientation="horizontal">
                          <Checkbox
                            id={`catalog-pair-${candidate.id}`}
                            checked={checked}
                            disabled={!checked && pairedProductIds.length >= 20}
                            onCheckedChange={(selected) =>
                              setPairedProductIds((current) =>
                                selected
                                  ? current.includes(candidate.id)
                                    ? current
                                    : [...current, candidate.id]
                                  : current.filter((id) => id !== candidate.id),
                              )
                            }
                          />
                          <FieldLabel htmlFor={`catalog-pair-${candidate.id}`}>
                            {candidate.name} · {candidate.variant}
                            {candidate.active ? "" : " (inactive)"}
                          </FieldLabel>
                        </Field>
                      );
                    })}
                    {!pairingChoices.length && (
                      <FieldDescription>
                        No other products are available to pair yet.
                      </FieldDescription>
                    )}
                  </FieldGroup>
                </FieldSet>
                <div className="flex flex-wrap gap-6">
                  <Field orientation="horizontal">
                    <Checkbox
                      id="catalog-stockable"
                      checked={stockable}
                      onCheckedChange={(value) => setStockable(Boolean(value))}
                    />
                    <FieldLabel htmlFor="catalog-stockable">Track inventory</FieldLabel>
                  </Field>
                  <Field orientation="horizontal">
                    <Checkbox
                      id="catalog-active"
                      checked={active}
                      onCheckedChange={(value) => setActive(Boolean(value))}
                    />
                    <FieldLabel htmlFor="catalog-active">Active</FieldLabel>
                  </Field>
                  <Field orientation="horizontal">
                    <Checkbox
                      id="catalog-promoted"
                      checked={promoted}
                      onCheckedChange={(value) => setPromoted(Boolean(value))}
                    />
                    <FieldLabel htmlFor="catalog-promoted">Promoted</FieldLabel>
                  </Field>
                </div>
              </>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : `Save ${kind}`}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
