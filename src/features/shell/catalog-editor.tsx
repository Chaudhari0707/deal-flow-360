"use client";

import { type FormEvent, useState } from "react";

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
import { CustomerInvitationStatus } from "@/features/catalog/customer-invitation-status";
import { CustomerDelete } from "@/features/shell/customer-delete";
import { useWorkspace } from "@/features/shell/use-workspace";
import { apiClient, apiData, HttpResponseError } from "@/lib/api/client";
import type { Workspace } from "@/lib/domain/_types/workspace";

/**
 * Editorial record editor. Grouping comes from hairline rules and column rhythm rather than
 * nested boxes: labels recede to quiet letterspaced kickers and every control is a value sitting
 * on its own rule, so the data the user is typing stays the loudest thing in the dialog.
 */
const labelType = "text-[0.6875rem] font-medium tracking-[0.16em] text-muted-foreground uppercase";
const ruledInput =
  "h-9 rounded-none border-0 border-b-2 border-border-strong bg-transparent px-0 text-sm focus-visible:border-ink-accent dark:bg-transparent";
const ruledArea =
  "min-h-20 rounded-none border-0 border-b-2 border-border-strong bg-transparent px-0 py-2 text-sm focus-visible:border-ink-accent dark:bg-transparent";
const ruledSelect =
  "w-full rounded-none border-0 border-b-2 border-border-strong bg-transparent px-0 hover:bg-transparent focus-visible:border-ink-accent data-[size=default]:h-9";
const twoUp = "grid gap-x-8 gap-y-6 sm:grid-cols-2";

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

function priceFields(product?: Workspace["products"][number]) {
  return [
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
    { name: "tax", label: "Tax (%)", value: (product?.taxBps ?? 0) / 100, step: "0.01", max: 100 },
    {
      name: "promotion",
      label: "Promotion discount (%)",
      value: (product?.promotionBps ?? 0) / 100,
      step: "0.01",
      max: 100,
    },
  ];
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
  const [createdCustomerId, setCreatedCustomerId] = useState<string>();
  const [stockable, setStockable] = useState(product?.stockable ?? false);
  const [active, setActive] = useState(product?.active ?? true);
  const [promoted, setPromoted] = useState(product?.promoted ?? false);
  const [pairedProductIds, setPairedProductIds] = useState(
    () => product?.pairedProductIds.filter((id) => id !== product.id) ?? [],
  );
  const { data } = useWorkspace();
  const pairingChoices = data?.products.filter((candidate) => candidate.id !== product?.id) ?? [];
  const existing = kind === "product" ? product : customer;
  const invitedCustomerId = kind === "customer" ? (customer?.id ?? createdCustomerId) : undefined;
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
        else {
          const result = apiData(await customers.post(body));
          if (result.invitation.status !== "SENT") {
            setCreatedCustomerId(result.id);
            await saved();
            return;
          }
        }
      }
      await saved();
      close();
    } catch (failure) {
      setError(
        failure instanceof HttpResponseError && failure.status === 403
          ? "Your role cannot change this catalog."
          : failure instanceof HttpResponseError
            ? failure.message
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
      <DialogContent className="border-t-2 border-t-foreground sm:max-w-2xl">
        <DialogHeader className="border-b border-border-strong pb-4">
          <span aria-hidden className="block h-0.5 w-7 bg-ink-accent" />
          <DialogTitle className="mt-2 text-2xl leading-tight font-semibold tracking-tight text-foreground">
            {existing ? "Edit" : "Add"} {kind}
          </DialogTitle>
          <DialogDescription className="max-w-[68ch] leading-relaxed">
            {kind === "product"
              ? "Each variant is a separate SKU with its own final unit price. Catalog changes apply to new quotation lines; existing quotes keep their pricing snapshots."
              : "New customers receive a portal login and a temporary password by email. Existing customers keep their password when details change; changing their login email signs them out."}
          </DialogDescription>
        </DialogHeader>
        <form method="post" onSubmit={submit}>
          <DialogBody>
            <FieldGroup className="gap-7">
              <Field>
                <FieldLabel htmlFor="catalog-name" className={labelType}>
                  Name
                </FieldLabel>
                <Input
                  id="catalog-name"
                  name="name"
                  required
                  maxLength={120}
                  defaultValue={existing?.name}
                  className={ruledInput}
                />
              </Field>
              {kind === "customer" ? (
                <>
                  <Field>
                    <FieldLabel htmlFor="catalog-email" className={labelType}>
                      Customer email
                    </FieldLabel>
                    <Input
                      id="catalog-email"
                      name="email"
                      type="email"
                      required
                      maxLength={254}
                      defaultValue={customer?.email}
                      className={ruledInput}
                    />
                  </Field>
                  <div className={twoUp}>
                    <Field>
                      <FieldLabel htmlFor="catalog-tier" className={labelType}>
                        Tier
                      </FieldLabel>
                      <Select name="tier" defaultValue={customer?.tier ?? "Bronze"}>
                        <SelectTrigger id="catalog-tier" className={ruledSelect}>
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
                      <FieldLabel htmlFor="catalog-team" className={labelType}>
                        Sales team
                      </FieldLabel>
                      <Input
                        id="catalog-team"
                        name="team"
                        required
                        maxLength={100}
                        defaultValue={customer?.team ?? "Enterprise"}
                        className={ruledInput}
                      />
                    </Field>
                  </div>
                </>
              ) : (
                <>
                  <div className={twoUp}>
                    <Field>
                      <FieldLabel htmlFor="catalog-category" className={labelType}>
                        Category
                      </FieldLabel>
                      <Select name="category" defaultValue={product?.category ?? "Hardware"}>
                        <SelectTrigger id="catalog-category" className={ruledSelect}>
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
                      <FieldLabel htmlFor="catalog-variant" className={labelType}>
                        Variant
                      </FieldLabel>
                      <Input
                        id="catalog-variant"
                        name="variant"
                        required
                        maxLength={100}
                        defaultValue={product?.variant ?? "Standard"}
                        className={ruledInput}
                      />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="catalog-description" className={labelType}>
                      Description
                    </FieldLabel>
                    <Textarea
                      id="catalog-description"
                      name="description"
                      maxLength={2000}
                      defaultValue={product?.description}
                      className={ruledArea}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-6 border-t border-border pt-7 sm:grid-cols-3">
                    {priceFields(product).map((field) => (
                      <Field key={field.name}>
                        <FieldLabel htmlFor={`catalog-${field.name}`} className={labelType}>
                          {field.label}
                        </FieldLabel>
                        <NumberInput
                          id={`catalog-${field.name}`}
                          name={field.name}
                          required
                          min="0"
                          max={field.max}
                          step={field.step}
                          defaultValue={field.value}
                          className={ruledInput}
                        />
                      </Field>
                    ))}
                    <Field>
                      <FieldLabel htmlFor="catalog-interval" className={labelType}>
                        Billing interval
                      </FieldLabel>
                      <Select name="interval" defaultValue={String(product?.intervalMonths ?? 0)}>
                        <SelectTrigger id="catalog-interval" className={ruledSelect}>
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
                      <FieldLabel htmlFor="catalog-unit" className={labelType}>
                        Unit
                      </FieldLabel>
                      <Input
                        id="catalog-unit"
                        name="unit"
                        required
                        maxLength={50}
                        defaultValue={product?.unit ?? "unit"}
                        className={ruledInput}
                      />
                    </Field>
                  </div>
                  <FieldSet className="border-t border-border pt-7">
                    <FieldLegend>Suggested pairings</FieldLegend>
                    <FieldDescription className="max-w-[68ch]">
                      When this item is on a quotation, these products appear as add-on suggestions.
                      Choose up to 20.
                    </FieldDescription>
                    <FieldGroup className="max-h-56 gap-0 overflow-y-auto border-t border-border">
                      {pairingChoices.map((candidate) => {
                        const checked = pairedProductIds.includes(candidate.id);
                        return (
                          <Field
                            key={candidate.id}
                            orientation="horizontal"
                            className="border-b border-border py-2.5"
                          >
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
                            <FieldLabel
                              htmlFor={`catalog-pair-${candidate.id}`}
                              className="text-sm font-normal text-foreground"
                            >
                              {candidate.name} · {candidate.variant}
                              {candidate.active ? "" : " (inactive)"}
                            </FieldLabel>
                          </Field>
                        );
                      })}
                      {!pairingChoices.length && (
                        <FieldDescription className="py-2.5">
                          No other products are available to pair yet.
                        </FieldDescription>
                      )}
                    </FieldGroup>
                  </FieldSet>
                  <div className="flex flex-wrap gap-x-8 gap-y-4 border-t border-border pt-6">
                    <Field orientation="horizontal">
                      <Checkbox
                        id="catalog-stockable"
                        checked={stockable}
                        onCheckedChange={(value) => setStockable(Boolean(value))}
                      />
                      <FieldLabel
                        htmlFor="catalog-stockable"
                        className="text-sm font-normal text-foreground"
                      >
                        Track inventory
                      </FieldLabel>
                    </Field>
                    <Field orientation="horizontal">
                      <Checkbox
                        id="catalog-active"
                        checked={active}
                        onCheckedChange={(value) => setActive(Boolean(value))}
                      />
                      <FieldLabel
                        htmlFor="catalog-active"
                        className="text-sm font-normal text-foreground"
                      >
                        Active
                      </FieldLabel>
                    </Field>
                    <Field orientation="horizontal">
                      <Checkbox
                        id="catalog-promoted"
                        checked={promoted}
                        onCheckedChange={(value) => setPromoted(Boolean(value))}
                      />
                      <FieldLabel
                        htmlFor="catalog-promoted"
                        className="text-sm font-normal text-foreground"
                      >
                        Promoted
                      </FieldLabel>
                    </Field>
                  </div>
                </>
              )}
              {invitedCustomerId && <CustomerInvitationStatus id={invitedCustomerId} />}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </FieldGroup>
          </DialogBody>
          <DialogFooter>
            {kind === "customer" && customer && (
              <div className="flex flex-col sm:mr-auto">
                <CustomerDelete
                  id={customer.id}
                  name={customer.name}
                  disabled={pending}
                  deleted={async () => {
                    await saved();
                    close();
                  }}
                />
              </div>
            )}
            <Button type="button" variant="outline" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || Boolean(createdCustomerId)}>
              {pending ? "Saving…" : `Save ${kind}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
