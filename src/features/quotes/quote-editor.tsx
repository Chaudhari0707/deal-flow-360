"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
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
import type { LineInput } from "@/features/quotes/_types/quotes";
import { PurchaseRecommendations } from "@/features/quotes/purchase-recommendations";
import { eyebrowType, ruledControl, SectionHead } from "@/features/quotes/quote-editorial";
import { QuoteLines } from "@/features/quotes/quote-lines";
import { QuoteTotals } from "@/features/quotes/quote-summary";
import {
  calculateQuote,
  defaultDiscounts,
  defaultPricelists,
  money,
  priceLines,
} from "@/features/quotes/rules";
import { apiClient, apiData } from "@/lib/api/client";
import type { Workspace } from "@/lib/domain/_types/workspace";
import { cn } from "@/lib/utils";

const labelType = cn(eyebrowType, "text-muted-foreground");

export function QuoteEditor({
  data,
  quote,
  onSaved,
}: {
  data: Workspace;
  quote?: Workspace["quotes"][number];
  onSaved: () => Promise<unknown>;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(quote?.customerId ?? data.customers[0]?.id ?? "");
  const [lines, setLines] = useState<LineInput[]>(
    quote?.lines.map((l) => ({
      id: l.id,
      productId: l.productId,
      quantity: l.quantity,
      discountBps: l.discountBps,
      upsell: l.upsell,
    })) ?? [],
  );
  const [orderDiscountBps, setOrderDiscount] = useState(quote?.orderDiscountBps ?? 0),
    [notes, setNotes] = useState(quote?.notes ?? ""),
    [date, setDate] = useState(quote?.promisedDate ?? "");
  const [productId, setProductId] = useState(data.products[0]?.id ?? ""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const customer = data.customers.find((c) => c.id === customerId),
    limits = data.settings.find((s) => s.id === "discounts")?.value ?? defaultDiscounts;
  const pricelists = data.settings.find((setting) => setting.id === "pricelists")?.value;
  let totals: ReturnType<typeof calculateQuote> | undefined,
    validation = "";
  try {
    totals = calculateQuote(
      priceLines(data.products, customer?.tier ?? "Bronze", lines, pricelists),
      orderDiscountBps,
      customer?.tier ?? "Bronze",
      limits,
    );
  } catch (e) {
    validation = e instanceof Error ? e.message : "Invalid quotation";
  }
  function add(id: string, upsell = false) {
    const p = data.products.find((p) => p.id === id);
    if (!p) return;
    setLines((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        productId: id,
        quantity: 1,
        discountBps: p.promoted ? p.promotionBps : 0,
        upsell,
      },
    ]);
  }
  function update(index: number, patch: Partial<LineInput>) {
    setLines((current) => current.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }
  async function save(submit: boolean) {
    setPending(true);
    setError("");
    try {
      const payload = {
        customerId,
        lines,
        orderDiscountBps,
        notes,
        ...(date ? { promisedDate: date } : {}),
        ...(quote ? { revision: quote.revision } : {}),
      };
      const saved = quote
        ? apiData(
            await apiClient.api.v1.quotes({ id: quote.id }).patch(payload),
            "The action failed. Refresh and try again.",
          )
        : apiData(
            await apiClient.api.v1.quotes.post(payload),
            "The action failed. Refresh and try again.",
          );
      if (submit)
        apiData(
          await apiClient.api.v1.quotes({ id: saved.id }).submit.post({
            revision: saved.revision,
          }),
          "The action failed. Refresh and try again.",
        );
      await onSaved();
      router.push(`/quotations/${saved.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save quotation");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="grid items-start gap-x-14 gap-y-12 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <section>
          <SectionHead index="01" title="Commercial terms">
            Tier pricing and category limits are applied automatically.
          </SectionHead>
          <div className="grid gap-x-10 gap-y-7 pt-6 sm:grid-cols-2">
            <Field>
              <FieldLabel className={labelType}>Customer</FieldLabel>
              <Select
                value={customerId}
                onValueChange={(v) => v && setCustomerId(v)}
                items={data.customers.map((c) => ({ value: c.id, label: `${c.name} · ${c.tier}` }))}
              >
                <SelectTrigger aria-label="Customer" className={cn(ruledControl, "w-full")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} · {c.tier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {customer && (
                <p
                  className="max-w-[60ch] text-xs leading-relaxed text-muted-foreground"
                  role="note"
                >
                  {customer.tier} tier: up to {(limits[customer.tier] ?? 0) / 100}% discount without
                  approval. Hardware tier pricing:{" "}
                  {(10000 -
                    (pricelists?.[customer.tier] ?? defaultPricelists[customer.tier] ?? 10000)) /
                    100}
                  % below base price. Category limits may be lower. Tier ceilings are limits, not
                  automatic discounts.
                </p>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="promise-date" className={labelType}>
                Promised delivery
              </FieldLabel>
              <Input
                id="promise-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={ruledControl}
              />
            </Field>
          </div>
        </section>
        <section className="mt-14">
          <SectionHead index="02" title="Quotation lines">
            Prices in INR. Discounts update line status, totals and margin immediately.
          </SectionHead>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3 py-6">
            <Select
              value={productId}
              onValueChange={(v) => v && setProductId(v)}
              items={data.products
                .filter((p) => p.active)
                .map((p) => ({ value: p.id, label: `${p.name} · ${money(p.priceCents)}` }))}
            >
              <SelectTrigger
                aria-label="Product to add"
                className={cn(ruledControl, "min-w-0 flex-1")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {data.products
                  .filter((p) => p.active)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {money(p.priceCents)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button variant="outline" disabled={lines.length >= 100} onClick={() => add(productId)}>
              Add product
            </Button>
          </div>
          <QuoteLines
            limits={limits}
            lines={lines}
            orderDiscountBps={orderDiscountBps}
            priced={totals?.lines}
            products={data.products}
            tier={customer?.tier ?? "Bronze"}
            onRemove={(index) => setLines((current) => current.filter((_, i) => i !== index))}
            onUpdate={update}
          />
          <div className="grid gap-x-10 gap-y-7 pt-10 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="order-discount" className={labelType}>
                Order discount %
              </FieldLabel>
              <NumberInput
                id="order-discount"
                min={0}
                max={100}
                step="0.01"
                value={orderDiscountBps / 100}
                onValueChange={(value) =>
                  setOrderDiscount(value === undefined ? Number.NaN : Math.round(value * 100))
                }
                className={ruledControl}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="quote-notes" className={labelType}>
                Internal justification
              </FieldLabel>
              <Textarea
                id="quote-notes"
                maxLength={2000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Context for your approver"
                className={ruledControl}
              />
            </Field>
          </div>
          {validation && lines.length > 0 && (
            <Alert variant="destructive" className="mt-8">
              <AlertDescription>{validation}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive" className="mt-8">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="mt-10 flex flex-wrap items-center gap-5 border-t border-border-strong pt-6">
            <Button
              variant="outline"
              disabled={pending || !!validation || !customerId}
              onClick={() => void save(false)}
            >
              {pending ? "Saving…" : "Save draft"}
            </Button>
            <Button
              disabled={pending || !!validation || !customerId}
              onClick={() => void save(true)}
            >
              {pending ? "Working…" : "Save and submit"}
            </Button>
          </div>
        </section>
      </div>
      <div className="space-y-12">
        <PurchaseRecommendations
          products={data.products}
          selectedProductIds={lines.map((line) => line.productId)}
          disabled={pending || lines.length >= 100 || (lines.length > 0 && !!validation)}
          limits={limits}
          orderDiscountBps={orderDiscountBps}
          onAdd={(id) => add(id, true)}
          pricelists={pricelists}
          tier={customer?.tier ?? "Bronze"}
        />
        <QuoteTotals totals={totals} />
      </div>
    </div>
  );
}
