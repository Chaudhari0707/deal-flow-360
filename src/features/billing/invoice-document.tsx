"use client";
import { useState } from "react";
import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  editorialInk,
  Eyebrow,
  eyebrowType,
  Meta,
  StatusMark,
} from "@/features/billing/invoice-editorial";
import { invoiceOutstanding } from "@/features/billing/rules";
import { displayDate, displayStatus, money } from "@/features/shell/format";
import type { Workspace } from "@/lib/domain/_types/workspace";
import { cn } from "@/lib/utils";

const headCell =
  "h-auto border-b border-foreground/30 px-0 pt-0 pr-6 pb-2.5 text-[0.6875rem] font-medium tracking-[0.16em] text-foreground/45 uppercase last:pr-0";
const bodyCell = "border-b border-foreground/10 px-0 py-3.5 pr-6 align-top last:pr-0";

function TotalLine({
  label,
  strong = false,
  value,
}: {
  label: string;
  strong?: boolean;
  value: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-8",
        strong
          ? "mt-1 border-t-2 border-foreground pt-3.5"
          : "border-b border-foreground/10 py-2.5",
      )}
    >
      <dt className={strong ? cn(eyebrowType, "text-foreground/60") : "text-foreground/60"}>
        {label}
      </dt>
      <dd
        className={cn(
          "tabular-nums",
          strong ? "text-lg font-semibold text-foreground" : "text-foreground/85",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function InvoiceDocument({
  canPay,
  credits,
  customerName,
  invoice,
  onClose,
  onRecordPayment,
  orderNumber,
  payments,
  pending,
}: {
  canPay: boolean;
  credits: Workspace["credits"];
  customerName: string;
  invoice: Workspace["invoices"][number];
  onClose: () => void;
  onRecordPayment: (reference: string) => void;
  orderNumber: string;
  payments: Workspace["payments"];
  pending: boolean;
}) {
  const [reference, setReference] = useState("");
  const outstanding = invoiceOutstanding(invoice);
  const settled = outstanding === 0;
  const showPaymentForm = canPay && !settled;
  const period =
    invoice.periodStart && invoice.periodEnd
      ? `${displayDate(invoice.periodStart)} — ${displayDate(invoice.periodEnd)}`
      : "One-time";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={cn(
          editorialInk,
          "gap-0 rounded-none border-t-2 border-foreground bg-background p-0 ring-foreground/15 sm:max-w-4xl",
        )}
      >
        <DialogHeader className="flex-row flex-wrap items-start justify-between gap-x-10 gap-y-6 px-8 pt-9">
          <div>
            <Eyebrow>{displayStatus(invoice.kind)} invoice</Eyebrow>
            <DialogTitle className="mt-3 text-3xl leading-none font-semibold tracking-tight text-foreground">
              {invoice.number}
            </DialogTitle>
            <DialogDescription className="mt-3 text-sm text-foreground/60">
              {customerName} · {orderNumber}
            </DialogDescription>
          </div>
          <div className="text-right">
            <Eyebrow>{settled ? "Settled in full" : "Outstanding"}</Eyebrow>
            <p className="mt-3 text-3xl leading-none font-medium tracking-tight text-foreground tabular-nums">
              {money(settled ? invoice.totalCents : outstanding)}
            </p>
            <div className="mt-3 flex justify-end text-sm">
              <StatusMark
                label={settled ? displayStatus(invoice.status) : "Awaiting payment"}
                tone={settled ? "settled" : "open"}
              />
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="px-8">
          <dl className="mt-8 grid grid-cols-2 gap-y-6 border-y border-foreground/15 py-5 sm:grid-cols-4 sm:gap-0 sm:divide-x sm:divide-foreground/10">
            <div className="sm:pr-6">
              <Meta label="Issued" value={displayDate(invoice.createdAt)} />
            </div>
            <div className="sm:px-6">
              <Meta label="Due" value={displayDate(invoice.dueDate)} />
            </div>
            <div className="sm:px-6">
              <Meta label="Service period" value={period} />
            </div>
            <div className="sm:pl-6">
              <Meta label="Line items" value={invoice.lines.length} />
            </div>
          </dl>

          <section className="pt-9">
            <h3 className={cn(eyebrowType, "text-foreground/50")}>Billed items</h3>
            <Table className="mt-4 text-[0.8125rem]">
              <TableHeader>
                <TableRow>
                  <TableHead className={headCell}>Description</TableHead>
                  <TableHead className={cn(headCell, "text-right")}>Qty</TableHead>
                  <TableHead className={cn(headCell, "text-right")}>Unit price</TableHead>
                  <TableHead className={cn(headCell, "text-right")}>Discount</TableHead>
                  <TableHead className={cn(headCell, "text-right")}>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.lines.map((line) => (
                  <TableRow key={line.id} className="border-0 hover:bg-transparent">
                    <TableCell className={cn(bodyCell, "whitespace-normal")}>
                      <span className="block text-foreground">{line.name}</span>
                      <span className="mt-1 block text-xs text-foreground/45">{line.variant}</span>
                    </TableCell>
                    <TableCell
                      className={cn(bodyCell, "text-right text-foreground/70 tabular-nums")}
                    >
                      {line.quantity}
                    </TableCell>
                    <TableCell
                      className={cn(bodyCell, "text-right text-foreground/70 tabular-nums")}
                    >
                      {money(line.priceCents)}
                    </TableCell>
                    <TableCell
                      className={cn(bodyCell, "text-right text-foreground/50 tabular-nums")}
                    >
                      {line.discountBps > 0 ? `${line.discountBps / 100}%` : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        bodyCell,
                        "text-right font-medium text-foreground tabular-nums",
                      )}
                    >
                      {money(line.netCents)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <dl className="mt-8 ml-auto w-full max-w-xs text-sm">
              <TotalLine label="Subtotal" value={money(invoice.subtotalCents)} />
              <TotalLine label="Tax" value={money(invoice.taxCents)} />
              <TotalLine label="Payments received" value={`− ${money(invoice.paidCents)}`} />
              <TotalLine label="Credits applied" value={`− ${money(invoice.creditedCents)}`} />
              <TotalLine strong label="Outstanding" value={money(outstanding)} />
            </dl>
          </section>

          {(payments.length > 0 || credits.length > 0) && (
            <section className="pt-10">
              <h3
                className={cn(eyebrowType, "border-b border-foreground/30 pb-3 text-foreground/50")}
              >
                Settlement ledger
              </h3>
              <ul className="mt-1">
                {payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex gap-4 border-b border-foreground/10 py-4 text-sm last:border-0"
                  >
                    <span
                      aria-hidden
                      className="mt-1.5 size-1.5 shrink-0 bg-[var(--ink-settled)]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground">Payment recorded</p>
                      <p className="mt-1 text-xs text-foreground/55">
                        {displayDate(payment.createdAt)} · Reference {payment.reference}
                      </p>
                    </div>
                    <span className="font-medium text-foreground tabular-nums">
                      {money(payment.amountCents)}
                    </span>
                  </li>
                ))}
                {credits.map((credit) => (
                  <li
                    key={credit.id}
                    className="flex gap-4 border-b border-foreground/10 py-4 text-sm last:border-0"
                  >
                    <span aria-hidden className="mt-1.5 size-1.5 shrink-0 bg-foreground/40" />
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground">Credit note {credit.number}</p>
                      <p className="mt-1 text-xs text-foreground/55">
                        {credit.reason}. Applied {money(credit.appliedCents)}; available{" "}
                        {money(credit.amountCents - credit.appliedCents)}. No cash refund was
                        recorded.
                      </p>
                    </div>
                    <span className="font-medium text-foreground tabular-nums">
                      {money(credit.amountCents)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {showPaymentForm && (
            <section className="pt-10 pb-9">
              <h3
                className={cn(eyebrowType, "border-b border-foreground/30 pb-3 text-foreground/50")}
              >
                Record settlement
              </h3>
              <form
                id="invoice-payment"
                method="post"
                className="mt-5 max-w-sm"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (reference.trim().length >= 3) onRecordPayment(reference.trim());
                }}
              >
                <Field>
                  <FieldLabel
                    htmlFor="payment-reference"
                    className={cn(eyebrowType, "text-foreground/50")}
                  >
                    Payment reference
                  </FieldLabel>
                  <Input
                    id="payment-reference"
                    required
                    minLength={3}
                    maxLength={100}
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    placeholder="Bank transfer or receipt reference"
                    className="h-9 rounded-none border-0 border-b-2 border-foreground/20 bg-transparent px-0 text-sm placeholder:text-foreground/40 focus-visible:border-foreground focus-visible:ring-0 dark:bg-transparent"
                  />
                  {reference.length > 0 && reference.trim().length < 3 && (
                    <FieldError>Use at least 3 characters.</FieldError>
                  )}
                </Field>
                <p className="mt-3 text-xs text-foreground/50">
                  Records the full outstanding balance of {money(outstanding)} against this invoice.
                </p>
              </form>
            </section>
          )}
        </DialogBody>

        <DialogFooter
          showCloseButton
          className="mx-0 mb-0 gap-3 rounded-b-none border-foreground/15 bg-background px-8 py-4 shadow-none [&_[data-slot=button]]:rounded-none"
        >
          <Button
            variant="outline"
            nativeButton={false}
            className="rounded-none border-foreground/25 bg-transparent"
            render={
              <a
                aria-label="Download invoice PDF"
                href={`/api/v1/invoices/${encodeURIComponent(invoice.id)}/pdf`}
              />
            }
          >
            <DownloadIcon />
            Download PDF
          </Button>
          {showPaymentForm && (
            <Button
              type="submit"
              form="invoice-payment"
              className="rounded-none"
              disabled={pending || reference.trim().length < 3}
            >
              Record full payment {money(outstanding)}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
