"use client";
import { useState } from "react";
import { DownloadIcon, ReceiptTextIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, DataTableDefaultToolbar } from "@/components/ui/data-table";
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
import { invoiceOutstanding } from "@/features/billing/rules";
import { invoiceColumns } from "@/features/billing/table-columns";
import { useBillingAction } from "@/features/billing/use-billing-action";
import { displayDate, displayStatus, money } from "@/features/shell/format";
import { PageHeader } from "@/features/shell/page-header";
import { useWorkspace } from "@/features/shell/use-workspace";
import { WorkspaceState } from "@/features/shell/workspace-state";
import { apiClient, apiData } from "@/lib/api/client";

export function InvoiceWorkspace({ initialId }: { initialId?: string }) {
  const { data, error, mutate } = useWorkspace();
  const [selected, setSelected] = useState<string | null>(initialId ?? null);
  const [search, setSearch] = useState("");
  const [reference, setReference] = useState("");
  const action = useBillingAction();
  if (!data) return <WorkspaceState error={error} retry={() => void mutate()} />;
  const invoice = data.invoices.find((entry) => entry.id === selected);
  const canPay = data.actor.role === "finance";
  const rows = data.invoices.filter((entry) =>
    `${entry.number} ${data.customers.find((customer) => customer.id === entry.customerId)?.name ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        title="Invoices"
        description="Reconcile every dollar. One-time, recurring and adjustment invoices stay linked to their source order."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Outstanding",
            value: money(data.invoices.reduce((sum, entry) => sum + invoiceOutstanding(entry), 0)),
          },
          {
            label: "Collected",
            value: money(data.invoices.reduce((sum, entry) => sum + entry.paidCents, 0)),
          },
          {
            label: "Customer credit",
            value: money(
              data.credits.reduce((sum, entry) => sum + entry.amountCents - entry.appliedCents, 0),
            ),
          },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader>
              <CardDescription>{item.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{item.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      {action.error && (
        <Alert variant="destructive">
          <AlertTitle>Action could not complete</AlertTitle>
          <AlertDescription>{action.error}</AlertDescription>
        </Alert>
      )}
      {action.message && (
        <Alert>
          <AlertDescription>{action.message}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardContent>
          <DataTable
            toolbar={(table, extras) => (
              <DataTableDefaultToolbar
                table={table}
                title="Invoice register"
                description="Select an invoice to review its lines, record payment, or download its PDF."
                searchValue={search}
                onSearchValueChange={setSearch}
                searchPlaceholder="Search invoice or customer"
                actions={extras.bulkRemove}
              />
            )}
            columns={invoiceColumns}
            data={rows.map((entry) => ({
              ...entry,
              customerName:
                data.customers.find((customer) => customer.id === entry.customerId)?.name ??
                "Customer",
            }))}
            getRowId={(row) => row.id}
            onRowClick={(row) => {
              setSelected(row.id);
              setReference("");
            }}
            emptyMessage="No invoices yet. Confirm a quote to generate its billing."
          />
        </CardContent>
      </Card>
      {invoice && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
        >
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ReceiptTextIcon className="size-4" />
                {invoice.number}
              </DialogTitle>
              <DialogDescription>
                {data.customers.find((customer) => customer.id === invoice.customerId)?.name} ·{" "}
                {data.orders.find((order) => order.id === invoice.orderId)?.number} ·{" "}
                {displayStatus(invoice.kind)}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-5">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>
                        {line.name} · {line.variant}
                      </TableCell>
                      <TableCell>{line.quantity}</TableCell>
                      <TableCell className="text-right">{money(line.totalCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex flex-wrap gap-6 text-sm">
                <span>Subtotal {money(invoice.subtotalCents)}</span>
                <span>Tax {money(invoice.taxCents)}</span>
                <span>Payments {money(invoice.paidCents)}</span>
                <span>Applied credits {money(invoice.creditedCents)}</span>
                <strong>Outstanding {money(invoiceOutstanding(invoice))}</strong>
              </div>
              {canPay && invoiceOutstanding(invoice) > 0 && (
                <form
                  id="invoice-payment"
                  method="post"
                  className="max-w-sm"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (reference.trim().length >= 3)
                      void action.run(
                        async () =>
                          apiData(
                            await apiClient.api.v1.invoices({ id: invoice.id }).pay.post({
                              operationKey: crypto.randomUUID(),
                              reference: reference.trim(),
                            }),
                          ),
                        "Payment recorded and balance reconciled.",
                      );
                  }}
                >
                  <Field className="max-w-sm">
                    <FieldLabel htmlFor="payment-reference">Payment reference</FieldLabel>
                    <Input
                      id="payment-reference"
                      required
                      minLength={3}
                      maxLength={100}
                      value={reference}
                      onChange={(event) => setReference(event.target.value)}
                      placeholder="Bank transfer or receipt reference"
                    />
                    {reference.length > 0 && reference.trim().length < 3 && (
                      <FieldError>Use at least 3 characters.</FieldError>
                    )}
                  </Field>
                </form>
              )}
              {data.payments
                .filter((payment) => payment.invoiceId === invoice.id)
                .map((payment) => (
                  <Alert key={payment.id}>
                    <AlertTitle>
                      Payment {money(payment.amountCents)} · {displayDate(payment.createdAt)}
                    </AlertTitle>
                    <AlertDescription>Reference: {payment.reference}</AlertDescription>
                  </Alert>
                ))}
              {data.credits
                .filter((credit) => credit.invoiceId === invoice.id)
                .map((credit) => (
                  <Alert key={credit.id}>
                    <AlertTitle>
                      {credit.number} · Credit {money(credit.amountCents)}
                    </AlertTitle>
                    <AlertDescription>
                      {credit.reason}. Applied {money(credit.appliedCents)}; available credit{" "}
                      {money(credit.amountCents - credit.appliedCents)}. No cash refund was
                      recorded.
                    </AlertDescription>
                  </Alert>
                ))}
            </DialogBody>
            <DialogFooter showCloseButton>
              <Button
                variant="outline"
                nativeButton={false}
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
              {canPay && invoiceOutstanding(invoice) > 0 && (
                <Button
                  type="submit"
                  form="invoice-payment"
                  disabled={action.pending || reference.trim().length < 3}
                >
                  Record full payment {money(invoiceOutstanding(invoice))}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
