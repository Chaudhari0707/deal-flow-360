"use client";

import { Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LineInput } from "@/features/quotes/_types/quotes";
import {
  documentCell,
  documentHead,
  documentRow,
  ruledControl,
} from "@/features/quotes/quote-editorial";
import { money } from "@/features/quotes/rules";
import type { QuoteLine } from "@/lib/domain/_types/domain";
import type { Workspace } from "@/lib/domain/_types/workspace";
import { cn } from "@/lib/utils";

const numericCell = cn(documentCell, "text-right");
const numericHead = cn(documentHead, "text-right");
const figureInput = cn(ruledControl, "text-right");

/**
 * The commercial core, set as a ledger rather than a stack of cards: one hairline-ruled row per
 * line, editable figures right-aligned and tabular so quantities, discounts and amounts compare
 * down the column, and the policy check as a marker plus text instead of a grid of pills.
 */
export function QuoteLines({
  limits,
  lines,
  onRemove,
  onUpdate,
  orderDiscountBps,
  priced,
  products,
  tier,
}: {
  limits: Record<string, number>;
  lines: LineInput[];
  onRemove: (index: number) => void;
  onUpdate: (index: number, patch: Partial<LineInput>) => void;
  orderDiscountBps: number;
  priced?: QuoteLine[];
  products: Workspace["products"];
  tier: string;
}) {
  if (!lines.length)
    return (
      <p className="border-b border-border py-10 text-sm text-muted-foreground">
        Add your first product to start building this quotation.
      </p>
    );
  return (
    <Table className="text-[0.8125rem]">
      <TableHeader>
        <TableRow className={documentRow}>
          <TableHead className={documentHead}>Line item</TableHead>
          <TableHead className={cn(numericHead, "w-24")}>Qty</TableHead>
          <TableHead className={cn(numericHead, "w-28")}>Discount %</TableHead>
          <TableHead className={cn(documentHead, "w-36")}>Policy</TableHead>
          <TableHead className={cn(numericHead, "w-32")}>Amount</TableHead>
          <TableHead className={cn(documentHead, "w-9")}>
            <span className="sr-only">Remove</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line, index) => {
          const product = products.find((entry) => entry.id === line.productId);
          const ceiling = Math.min(limits[tier] ?? 0, limits[product?.category ?? ""] ?? 0);
          const effective =
            10000 - ((10000 - line.discountBps) * (10000 - orderDiscountBps)) / 10000;
          return (
            <TableRow key={line.id} className={documentRow}>
              <TableCell className={cn(documentCell, "whitespace-normal")}>
                <span className="block font-medium text-foreground">{product?.name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {product?.category} · {product?.variant}
                  {product?.intervalMonths ? ` · every ${product.intervalMonths} month(s)` : ""}
                </span>
              </TableCell>
              <TableCell className={numericCell}>
                <NumberInput
                  id={`qty-${line.id}`}
                  aria-label={`${product?.name} quantity`}
                  min={1}
                  max={10000}
                  value={line.quantity}
                  onValueChange={(value) => onUpdate(index, { quantity: value ?? Number.NaN })}
                  className={figureInput}
                />
              </TableCell>
              <TableCell className={numericCell}>
                <NumberInput
                  id={`discount-${line.id}`}
                  aria-label={`${product?.name} discount`}
                  min={0}
                  max={100}
                  step="0.01"
                  value={line.discountBps / 100}
                  onValueChange={(value) =>
                    onUpdate(index, {
                      discountBps: value === undefined ? Number.NaN : Math.round(value * 100),
                    })
                  }
                  className={figureInput}
                />
              </TableCell>
              <TableCell className={documentCell}>
                <span className="block text-xs text-muted-foreground tabular-nums">
                  Ceiling {ceiling / 100}%
                </span>
                <span className="mt-1.5 block">
                  <Badge variant={effective > ceiling ? "destructive" : "secondary"}>
                    {effective > ceiling
                      ? `OVER +${((effective - ceiling) / 100).toFixed(2)}pt`
                      : "OK"}
                  </Badge>
                </span>
              </TableCell>
              <TableCell className={cn(numericCell, "pt-5 font-medium text-foreground")}>
                {priced?.[index] ? money(priced[index].totalCents) : "—"}
              </TableCell>
              <TableCell className={cn(documentCell, "pt-3.5 text-right")}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${product?.name}`}
                  onClick={() => onRemove(index)}
                >
                  <Trash2 />
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
