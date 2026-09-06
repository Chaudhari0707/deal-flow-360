"use client";
import { useState } from "react";

import type { InvoiceRegisterRow } from "@/features/billing/_types/tables";
import { InvoiceDocument } from "@/features/billing/invoice-document";
import { Eyebrow, Figure, Meta, Note } from "@/features/billing/invoice-editorial";
import { InvoiceRegister } from "@/features/billing/invoice-register";
import { invoiceOutstanding } from "@/features/billing/rules";
import { useBillingAction } from "@/features/billing/use-billing-action";
import { displayDate, money } from "@/features/shell/format";
import { useWorkspace } from "@/features/shell/use-workspace";
import { WorkspaceState } from "@/features/shell/workspace-state";
import { apiClient, apiData } from "@/lib/api/client";

const dayMs = 86_400_000;

function startOfToday() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function plural(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

export function InvoiceWorkspace({ initialId }: { initialId?: string }) {
  const { data, error, mutate } = useWorkspace();
  const [selected, setSelected] = useState<string | null>(initialId ?? null);
  const action = useBillingAction();
  if (!data) return <WorkspaceState error={error} retry={() => void mutate()} />;

  const today = startOfToday();
  const rows: InvoiceRegisterRow[] = data.invoices.map((entry) => {
    const customer = data.customers.find((record) => record.id === entry.customerId);
    const outstandingCents = invoiceOutstanding(entry);
    const dueTime = new Date(entry.dueDate).getTime();
    const late = outstandingCents > 0 && Number.isFinite(dueTime) && dueTime < today;
    return {
      ...entry,
      customerName: customer?.name ?? "Customer",
      customerTier: customer?.tier ?? "—",
      orderNumber: data.orders.find((order) => order.id === entry.orderId)?.number ?? "—",
      outstandingCents,
      overdueDays: late ? Math.floor((today - dueTime) / dayMs) : 0,
    };
  });

  const openRows = rows.filter((row) => row.outstandingCents > 0);
  const overdueRows = openRows.filter((row) => row.overdueDays > 0);
  const outstandingTotal = openRows.reduce((sum, row) => sum + row.outstandingCents, 0);
  const overdueTotal = overdueRows.reduce((sum, row) => sum + row.outstandingCents, 0);
  const collected = data.invoices.reduce((sum, entry) => sum + entry.paidCents, 0);
  const creditAvailable = data.credits.reduce(
    (sum, entry) => sum + entry.amountCents - entry.appliedCents,
    0,
  );
  const oldest = overdueRows.reduce((worst, row) => Math.max(worst, row.overdueDays), 0);

  const invoice = rows.find((entry) => entry.id === selected);
  const canPay = data.actor.role === "finance";

  return (
    <div className={"mx-auto w-full max-w-300 pb-6"}>
      <header className="border-t-2 border-foreground pt-7">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Eyebrow>Billing ledger</Eyebrow>
            <h1 className="mt-4 text-4xl leading-[1.05] font-semibold tracking-tight text-foreground md:text-5xl">
              Invoices
            </h1>
            <p className="mt-5 max-w-[52ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
              Every rupee, reconciled. One-time, recurring and adjustment invoices stay linked to
              the order that produced them, from issue through settlement.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-10 gap-y-6 self-end sm:grid-cols-3 lg:col-span-5">
            <Meta align="end" label="Register as of" value={displayDate(data.asOf)} />
            <Meta align="end" label="Currency" value="INR" />
            <Meta
              align="end"
              label="Your access"
              value={canPay ? "Settle & review" : "Review only"}
            />
          </dl>
        </div>
      </header>

      <section className="mt-11 border-t border-foreground/25">
        <h2 className="sr-only">Ledger summary</h2>
        <dl className="grid grid-cols-2 gap-x-10 sm:grid-cols-4 sm:gap-x-0 sm:divide-x sm:divide-foreground/10">
          <Figure
            accent
            label="Outstanding"
            value={money(outstandingTotal)}
            note={`Across ${plural(openRows.length, "open document")}`}
          />
          <Figure
            label="Past due"
            value={money(overdueTotal)}
            note={
              overdueRows.length
                ? `${plural(overdueRows.length, "document")} · oldest ${oldest} days`
                : "Nothing past its due date"
            }
          />
          <Figure
            label="Collected"
            value={money(collected)}
            note={`${plural(data.payments.length, "payment")} recorded`}
          />
          <Figure
            label="Credit on file"
            value={money(creditAvailable)}
            note={`${plural(data.credits.length, "credit note")} issued`}
          />
        </dl>
      </section>

      {action.error && (
        <Note tone="flag" title="Action could not complete">
          {action.error}
        </Note>
      )}
      {action.message && <Note>{action.message}</Note>}

      <InvoiceRegister
        rows={rows}
        onSelect={(id) => {
          setSelected(id);
        }}
      />

      {invoice && (
        <InvoiceDocument
          availableCustomerCreditCents={data.credits
            .filter((credit) => credit.customerId === invoice.customerId)
            .reduce((sum, credit) => sum + credit.amountCents - credit.appliedCents, 0)}
          canPay={canPay}
          credits={data.credits.filter((credit) => credit.invoiceId === invoice.id)}
          customerName={invoice.customerName}
          invoice={invoice}
          orderNumber={invoice.orderNumber}
          payments={data.payments.filter((payment) => payment.invoiceId === invoice.id)}
          pending={action.pending}
          onClose={() => setSelected(null)}
          onApplyCredit={() => {
            void action.run(
              async () =>
                apiData(
                  await apiClient.api.v1.invoices({ id: invoice.id })["apply-credit"].post({
                    operationKey: crypto.randomUUID(),
                  }),
                ),
              "Available customer credit applied to this invoice.",
            );
          }}
          onRecordPayment={(reference) => {
            void action.run(
              async () =>
                apiData(
                  await apiClient.api.v1.invoices({ id: invoice.id }).pay.post({
                    operationKey: crypto.randomUUID(),
                    reference,
                  }),
                ),
              "Payment recorded and balance reconciled.",
            );
          }}
        />
      )}
    </div>
  );
}
