"use client";
import { useState } from "react";
import { CalendarSyncIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { subscriptionPreview } from "@/features/billing/subscription-preview";
import { subscriptionColumns } from "@/features/billing/table-columns";
import { useBillingAction } from "@/features/billing/use-billing-action";
import { displayDate, displayStatus, money } from "@/features/shell/format";
import { PageHeader } from "@/features/shell/page-header";
import { useWorkspace } from "@/features/shell/use-workspace";
import { WorkspaceState } from "@/features/shell/workspace-state";
import { apiClient, apiData } from "@/lib/api/client";

export function SubscriptionWorkspace() {
  const { data, error, mutate } = useWorkspace();
  const [selected, setSelected] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [productId, setProductId] = useState("");
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const action = useBillingAction();
  if (!data) return <WorkspaceState error={error} retry={() => void mutate()} />;
  const canManage = data.actor.role === "finance";
  const subscription = data.subscriptions.find((entry) => entry.id === selected);
  const product = data.products.find((entry) => entry.id === productId);
  const preview = subscriptionPreview(subscription, product, quantity);
  const valid = preview.valid && reason.trim().length >= 3;
  const adjustment = preview.adjustment;
  const cadence = (months: number) =>
    months === 12 ? "Yearly" : months === 3 ? "Quarterly" : "Monthly";
  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Recurring revenue with clear billing periods, actual-day adjustments and a preserved invoice history."
        actions={
          canManage ? (
            <Button
              disabled={action.pending}
              onClick={() =>
                void action.run(
                  async () => apiData(await apiClient.api.v1.subscriptions["run-due"].post()),
                  "Due billing completed. Each period is issued once.",
                )
              }
            >
              <CalendarSyncIcon />
              Run due billing
            </Button>
          ) : undefined
        }
      />
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
                title="Recurring contracts"
                description="Monthly, quarterly, and yearly plans."
                searchValue={search}
                onSearchValueChange={setSearch}
                searchLabel="Search subscriptions"
                searchPlaceholder="Search plan, customer or order"
                actions={extras.bulkRemove}
              />
            )}
            columns={subscriptionColumns}
            data={data.subscriptions
              .map((entry) => ({
                ...entry,
                orderNumber:
                  data.orders.find((order) => order.id === entry.orderId)?.number ?? entry.orderId,
                customerName:
                  data.customers.find((customer) => customer.id === entry.customerId)?.name ??
                  "Customer",
              }))
              .filter((entry) =>
                `${entry.name} ${entry.customerName} ${entry.orderNumber}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )}
            getRowId={(row) => row.id}
            onRowClick={(row) => {
              setSelected(row.id);
              setQuantity(row.quantity);
              setProductId(row.productId);
              setReason("");
            }}
            emptyMessage="Confirm a quote with a recurring product to start a subscription."
          />
        </CardContent>
      </Card>
      {subscription && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
        >
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{subscription.name}</DialogTitle>
              <DialogDescription>
                {displayDate(subscription.periodStart)} to {displayDate(subscription.periodEnd)} ·{" "}
                {cadence(subscription.intervalMonths)} · Invoice history is retained after
                cancellation.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-5">
              {canManage && subscription.status === "ACTIVE" ? (
                <form
                  id="subscription-change"
                  method="post"
                  className="space-y-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (valid)
                      void action.run(
                        async () =>
                          apiData(
                            await apiClient.api.v1
                              .subscriptions({ id: subscription.id })
                              .change.post({
                                operationKey: crypto.randomUUID(),
                                productId,
                                quantity,
                                reason: reason.trim(),
                                version: subscription.version,
                              }),
                          ),
                        "Subscription updated. Any prorated invoice or credit is in the invoice register.",
                      );
                  }}
                >
                  <div className="grid gap-5 md:grid-cols-3">
                    <Field>
                      <FieldLabel>Plan</FieldLabel>
                      <Select
                        value={productId}
                        onValueChange={(value) => {
                          if (value) setProductId(value);
                        }}
                      >
                        <SelectTrigger aria-label="Subscription plan" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {data.products
                            .filter(
                              (entry) =>
                                entry.active &&
                                entry.intervalMonths === subscription.intervalMonths &&
                                entry.taxBps === subscription.taxBps,
                            )
                            .map((entry) => (
                              <SelectItem key={entry.id} value={entry.id}>
                                {entry.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FieldDescription>
                        Changes use the same cadence and tax rate.
                      </FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="subscription-quantity">Quantity</FieldLabel>
                      <NumberInput
                        id="subscription-quantity"
                        min={1}
                        max={10000}
                        step={1}
                        value={quantity}
                        onValueChange={(value) => setQuantity(value ?? Number.NaN)}
                      />
                      {(!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) && (
                        <FieldError>
                          {!Number.isFinite(quantity)
                            ? "Enter a quantity."
                            : !Number.isInteger(quantity)
                              ? "Use a whole number (no decimals)."
                              : quantity < 1
                                ? "Enter at least 1."
                                : "Enter at most 10,000."}
                        </FieldError>
                      )}
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="subscription-reason">Reason</FieldLabel>
                      <Input
                        id="subscription-reason"
                        minLength={3}
                        maxLength={500}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="Explain the customer request"
                      />
                      {reason.length > 0 && reason.trim().length < 3 && (
                        <FieldError>Use at least 3 characters.</FieldError>
                      )}
                    </Field>
                  </div>
                  <Alert>
                    <AlertTitle>
                      {adjustment === null
                        ? "Due periods are reconciled before changes"
                        : `${adjustment < 0 ? "Estimated credit" : "Estimated adjustment"}: ${money(Math.abs(adjustment))}`}
                    </AlertTitle>
                    <AlertDescription>
                      Changes take effect today. Future or invalid billing periods and price data
                      must be corrected before changes. Actual remaining calendar days determine the
                      amount. The server confirms final cents and catches up any due periods.
                    </AlertDescription>
                  </Alert>
                </form>
              ) : (
                <Alert>
                  <AlertDescription>
                    {subscription.status === "CANCELLED"
                      ? "This subscription is cancelled. Issued invoices and credits remain available."
                      : "Finance can change or cancel this subscription."}
                  </AlertDescription>
                </Alert>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Stream</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.invoices
                    .filter((entry) => entry.subscriptionId === subscription.id)
                    .map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.number}</TableCell>
                        <TableCell>{displayStatus(entry.kind)}</TableCell>
                        <TableCell>{money(entry.totalCents)}</TableCell>
                        <TableCell>{displayStatus(entry.status)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </DialogBody>
            <DialogFooter showCloseButton>
              {canManage && subscription.status === "ACTIVE" && (
                <>
                  <Button
                    variant="destructive"
                    type="button"
                    disabled={action.pending || !valid}
                    onClick={() =>
                      void action.run(
                        async () =>
                          apiData(
                            await apiClient.api.v1
                              .subscriptions({ id: subscription.id })
                              .cancel.post({
                                operationKey: crypto.randomUUID(),
                                reason: reason.trim(),
                                version: subscription.version,
                              }),
                          ),
                        "Subscription cancelled. Unused service credit issued; future billing stopped.",
                      )
                    }
                  >
                    Cancel and credit unused service
                  </Button>
                  <Button
                    type="submit"
                    form="subscription-change"
                    disabled={action.pending || !valid}
                  >
                    Apply change
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
