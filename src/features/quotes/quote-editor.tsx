"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { LineInput } from "@/features/quotes/_types/quotes";
import { quoteRequest } from "@/features/quotes/client-action";
import { PurchaseRecommendations } from "@/features/quotes/purchase-recommendations";
import { calculateQuote, defaultDiscounts, money, priceLines } from "@/features/quotes/rules";
import type { Workspace } from "@/lib/domain/_types/workspace";

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
    [error, setError] = useState(""),
    [dismissed, setDismissed] = useState<string[]>([]);
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
      const saved = await quoteRequest<Workspace["quotes"][number]>(
        quote ? `/quotes/${quote.id}` : "/quotes",
        {
          customerId,
          lines,
          orderDiscountBps,
          notes,
          ...(date ? { promisedDate: date } : {}),
          ...(quote ? { revision: quote.revision } : {}),
        },
        quote ? "PATCH" : "POST",
      );
      if (submit) await quoteRequest(`/quotes/${saved.id}/submit`, { revision: saved.revision });
      await onSaved();
      router.push(`/quotations/${saved.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save quotation");
    } finally {
      setPending(false);
    }
  }
  const suggestedIds = new Set(
    lines.flatMap((l) => data.products.find((p) => p.id === l.productId)?.pairedProductIds ?? []),
  );
  const minMargin = data.settings.find((s) => s.id === "upsell")?.value.minimumMarginBps ?? 2000;
  const suggestions = data.products
    .filter(
      (p) =>
        !validation &&
        p.active &&
        suggestedIds.has(p.id) &&
        !dismissed.includes(p.id) &&
        !lines.some((l) => l.productId === p.id),
    )
    .map((p) => {
      const amount = calculateQuote(
        priceLines(
          data.products,
          customer?.tier ?? "Bronze",
          [{ productId: p.id, quantity: 1, discountBps: p.promoted ? p.promotionBps : 0 }],
          pricelists,
        ),
        orderDiscountBps,
        customer?.tier ?? "Bronze",
        limits,
      ).lines[0]!;
      return { product: p, line: amount, margin: amount.netCents - amount.costCents };
    })
    .filter((s) => s.line.netCents > 0 && (s.margin / s.line.netCents) * 10000 >= minMargin)
    .sort((a, b) => Number(b.product.promoted) - Number(a.product.promoted) || b.margin - a.margin);
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Commercial terms</CardTitle>
            <CardDescription>
              Tier pricing and category limits are applied automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Customer</FieldLabel>
              <Select value={customerId} onValueChange={(v) => v && setCustomerId(v)}>
                <SelectTrigger aria-label="Customer">
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
            </Field>
            <Field>
              <FieldLabel htmlFor="promise-date">Promised delivery</FieldLabel>
              <Input
                id="promise-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quotation lines</CardTitle>
            <CardDescription>
              Prices in USD. Discounts update line status, totals and margin immediately.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select value={productId} onValueChange={(v) => v && setProductId(v)}>
                <SelectTrigger aria-label="Product to add" className="flex-1">
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
              <Button
                variant="outline"
                disabled={lines.length >= 100}
                onClick={() => add(productId)}
              >
                <Plus />
                Add product
              </Button>
            </div>
            {lines.map((line, index) => {
              const product = data.products.find((p) => p.id === line.productId),
                priced = totals?.lines[index];
              const ceiling = Math.min(
                limits[customer?.tier ?? "Bronze"] ?? 0,
                limits[product?.category ?? ""] ?? 0,
              );
              const effective =
                10000 - ((10000 - line.discountBps) * (10000 - orderDiscountBps)) / 10000;
              return (
                <Card key={line.id} className="shadow-none">
                  <CardContent className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{product?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {product?.category} · {product?.variant}
                          {product?.intervalMonths
                            ? ` · every ${product.intervalMonths} month(s)`
                            : ""}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${product?.name}`}
                        onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4">
                      <Field>
                        <FieldLabel htmlFor={`qty-${line.id}`}>Quantity</FieldLabel>
                        <Input
                          id={`qty-${line.id}`}
                          aria-label={`${product?.name} quantity`}
                          type="number"
                          min={1}
                          max={10000}
                          value={line.quantity}
                          onChange={(e) => update(index, { quantity: Number(e.target.value) })}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`discount-${line.id}`}>Discount %</FieldLabel>
                        <Input
                          id={`discount-${line.id}`}
                          aria-label={`${product?.name} discount`}
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={line.discountBps / 100}
                          onChange={(e) =>
                            update(index, { discountBps: Math.round(Number(e.target.value) * 100) })
                          }
                        />
                      </Field>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Ceiling {ceiling / 100}%</p>
                        <Badge variant={effective > ceiling ? "destructive" : "secondary"}>
                          {effective > ceiling
                            ? `OVER +${((effective - ceiling) / 100).toFixed(2)}pt`
                            : "OK"}
                        </Badge>
                      </div>
                      <p className="text-right font-semibold tabular-nums">
                        {money(priced?.totalCents ?? 0)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {!lines.length && (
              <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                Add your first product to start building this quotation.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="order-discount">Order discount %</FieldLabel>
                <Input
                  id="order-discount"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={orderDiscountBps / 100}
                  onChange={(e) => setOrderDiscount(Math.round(Number(e.target.value) * 100))}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="quote-notes">Internal justification</FieldLabel>
                <Textarea
                  id="quote-notes"
                  maxLength={2000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Context for your approver"
                />
              </Field>
            </div>
            {validation && lines.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription>{validation}</AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-wrap gap-2">
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
          </CardContent>
        </Card>
      </div>
      <div className="space-y-4">
        <PurchaseRecommendations
          key={customerId}
          customerId={customerId}
          products={data.products}
          existingIds={lines.map((line) => line.productId)}
          disabled={pending || lines.length >= 100 || (lines.length > 0 && !!validation)}
          limits={limits}
          orderDiscountBps={orderDiscountBps}
          onAdd={(id) => add(id)}
          pricelists={pricelists}
          tier={customer?.tier ?? "Bronze"}
        />
        <Card>
          <CardHeader>
            <CardDescription>One-time total</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {money(totals?.totalCents ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{money(totals?.subtotalCents ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax</span>
              <span>{money(totals?.taxCents ?? 0)}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span>One-time margin</span>
              <span>{money(totals?.marginCents ?? 0)}</span>
            </div>
            {totals?.lines
              .filter((l) => l.intervalMonths > 0)
              .map((l) => (
                <div key={l.id} className="flex justify-between gap-2">
                  <span>{l.name}</span>
                  <span>
                    {money(l.totalCents)} / {l.intervalMonths}mo
                  </span>
                </div>
              ))}
            <Separator />
            <div className="flex items-center justify-between">
              <span>Approval route</span>
              <Badge variant={totals?.risk === "HIGH" ? "destructive" : "secondary"}>
                {totals?.risk ?? "—"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {totals?.risk === "HIGH"
                ? "Manager → Finance"
                : totals?.risk === "MEDIUM"
                  ? "Sales Manager"
                  : "Within policy · automatic approval"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">A better fit for this deal</CardTitle>
            <CardDescription>Relevant add-ons that meet your minimum margin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {suggestions.map((s) => (
              <div key={s.product.id} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{s.product.name}</p>
                  {s.product.promoted && <Badge variant="outline">Promotion</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  +{money(s.margin)} margin
                  {s.product.intervalMonths ? ` / ${s.product.intervalMonths}mo` : ""}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={`Add ${s.product.name} to quote`}
                    onClick={() => add(s.product.id, true)}
                  >
                    Add to quote
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Dismiss ${s.product.name} suggestion`}
                    onClick={() => setDismissed((current) => [...current, s.product.id])}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
            {!suggestions.length && (
              <p className="text-sm text-muted-foreground">
                Suggestions appear as you add matching products.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
