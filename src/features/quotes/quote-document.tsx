"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  documentCell,
  documentHead,
  documentRow,
  SectionHead,
  TotalLine,
} from "@/features/quotes/quote-editorial";
import { money } from "@/features/quotes/rules";
import type { Workspace } from "@/lib/domain/_types/workspace";
import { cn } from "@/lib/utils";

interface AuditEvent {
  action: string;
  actorName: string;
  createdAt: Date | string;
  id: string;
  reason: string;
}

const quietCell = cn(documentCell, "text-muted-foreground");
const numericHead = cn(documentHead, "text-right");

/**
 * The confirmed commercial record. Three numbered sections — what was quoted, why the discount
 * was allowed, and who acted — carried by rules and alignment rather than by three cards, with
 * the accepted figures right-aligned and tabular so the document reads as a ledger.
 */
export function QuoteDocument({
  activity,
  quote,
}: {
  activity: AuditEvent[];
  quote: Workspace["quotes"][number];
}) {
  const recurring = quote.lines.filter((line) => line.intervalMonths > 0);
  return (
    <div className="min-w-0 space-y-14">
      <section>
        <SectionHead index="01" title="Quotation summary">
          Accepted prices stay attached to this revision.
        </SectionHead>
        <Table className="mt-6 text-[0.8125rem]">
          <TableHeader>
            <TableRow className={documentRow}>
              <TableHead className={documentHead}>Product</TableHead>
              <TableHead className={cn(numericHead, "w-16")}>Qty</TableHead>
              <TableHead className={cn(numericHead, "w-24")}>Discount</TableHead>
              <TableHead className={cn(documentHead, "w-32")}>Billing</TableHead>
              <TableHead className={cn(numericHead, "w-32")}>Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quote.lines.map((line) => (
              <TableRow key={line.id} className={documentRow}>
                <TableCell className={cn(documentCell, "whitespace-normal")}>
                  <span className="block font-medium text-foreground">{line.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{line.variant}</span>
                </TableCell>
                <TableCell className={cn(quietCell, "text-right")}>{line.quantity}</TableCell>
                <TableCell className={cn(quietCell, "text-right")}>
                  {line.discountBps / 100}%
                </TableCell>
                <TableCell className={quietCell}>
                  {line.intervalMonths ? `Every ${line.intervalMonths}mo` : "One-time"}
                </TableCell>
                <TableCell className={cn(documentCell, "text-right font-medium text-foreground")}>
                  {money(line.totalCents)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <dl className="mt-8 ml-auto w-full max-w-xs text-sm">
          <TotalLine strong label="One-time total" value={money(quote.totalCents)} />
          {recurring.map((line) => (
            <TotalLine
              key={line.id}
              label={line.name}
              value={`${money(line.totalCents)} / ${line.intervalMonths}mo`}
            />
          ))}
        </dl>
      </section>

      <section>
        <SectionHead index="02" title="Discount review">
          The most restrictive customer and category ceiling applies to each line.
        </SectionHead>
        {quote.riskSnapshot?.lines.map((line, index) => (
          <div
            key={`${line.name}-${index}`}
            className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1 border-b border-border py-4"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{line.name}</p>
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                {line.effectiveBps / 100}% effective · {line.ceilingBps / 100}% ceiling
              </p>
            </div>
            <Badge variant={line.overBps > 0 ? "destructive" : "secondary"}>
              {line.overBps > 0 ? `+${(line.overBps / 100).toFixed(2)}pt over` : "Within policy"}
            </Badge>
          </div>
        ))}
        {quote.notes && (
          <p className="mt-6 max-w-[72ch] text-sm leading-relaxed text-muted-foreground">
            Justification: {quote.notes}
          </p>
        )}
      </section>

      <section>
        <SectionHead index="03" title="Audit trail">
          Who acted, when, and why.
        </SectionHead>
        {activity.map((event) => (
          <div key={event.id} className="flex gap-4 border-b border-border py-4">
            <span aria-hidden className="mt-1.5 size-1.5 shrink-0 bg-ink-accent" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <p className="text-sm font-medium text-foreground">
                  {event.action.replaceAll("_", " ")}
                </p>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {new Date(event.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {event.actorName} · {event.reason}
              </p>
            </div>
          </div>
        ))}
        {!activity.length && (
          <p className="pt-5 text-sm text-muted-foreground">
            Activity appears when the quotation is submitted.
          </p>
        )}
      </section>
    </div>
  );
}
