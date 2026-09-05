"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowRight,
  ArrowUpRight,
  Clock3,
  FileCheck2,
  IndianRupee,
  Plus,
  RefreshCw,
} from "lucide-react";

import type { DataTableFeatures } from "@/components/ui/_types/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { displayDate, displayStatus, money } from "@/features/shell/format";
import { PageHeader } from "@/features/shell/page-header";
import { useWorkspace } from "@/features/shell/use-workspace";
import { WorkspaceState } from "@/features/shell/workspace-state";
import type { Permission } from "@/lib/domain/_types/permissions";
import type { Workspace } from "@/lib/domain/_types/workspace";
import { can } from "@/lib/domain/permissions";

type QuoteRow = Workspace["quotes"][number] & { customerName: string };
const quoteColumns: ColumnDef<DataTableFeatures, QuoteRow>[] = [
  {
    accessorKey: "number",
    header: "Quotation",
    cell: ({ row }) => (
      <Link className="font-medium hover:underline" href={`/quotations/${row.original.id}`}>
        {row.original.number}
      </Link>
    ),
  },
  { accessorKey: "customerName", header: "Customer" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.original.status === "CONFIRMED" ? "default" : "secondary"}>
        {displayStatus(row.original.status)}
      </Badge>
    ),
  },
  {
    accessorKey: "totalCents",
    header: "Value",
    cell: ({ row }) => <span className="tabular-nums">{money(row.original.totalCents)}</span>,
  },
];

export function Dashboard() {
  const { data, error, mutate } = useWorkspace();
  const router = useRouter();
  if (error || !data)
    return (
      <WorkspaceState
        error={error}
        retry={() => {
          void mutate();
        }}
      />
    );
  const openQuotes = data.quotes.filter(
    (quote) => !["CONFIRMED", "REJECTED"].includes(quote.status),
  );
  const pendingQuotes = data.quotes.filter((quote) => quote.status === "PENDING_APPROVAL");
  const confirmed = data.quotes.filter((quote) => quote.status === "CONFIRMED");
  const activeSubscriptions = data.subscriptions.filter(
    (subscription) => subscription.status === "ACTIVE",
  );
  const monthlyRevenue = activeSubscriptions.reduce(
    (total, subscription) =>
      total +
      Math.round((subscription.priceCents * subscription.quantity) / subscription.intervalMonths),
    0,
  );
  const outstanding = data.invoices.reduce(
    (total, invoice) => total + invoice.totalCents - invoice.paidCents - invoice.creditedCents,
    0,
  );
  const recentQuotes = data.quotes.slice(0, 5).map((quote) => ({
    ...quote,
    customerName:
      data.customers.find((customer) => customer.id === quote.customerId)?.name ?? "Customer",
  }));
  const metrics = [
    {
      label: "One-time pipeline",
      value: money(openQuotes.reduce((sum, quote) => sum + quote.totalCents, 0)),
      detail: `${openQuotes.length} active quotations`,
      icon: IndianRupee,
      href: "/quotations",
    },
    {
      label: "Monthly recurring revenue",
      value: money(monthlyRevenue),
      detail: `${activeSubscriptions.length} active subscriptions · before tax`,
      icon: RefreshCw,
      href: "/subscriptions",
    },
    {
      label: "Awaiting approval",
      value: String(pendingQuotes.length),
      detail: "Decisions that keep deals moving",
      icon: Clock3,
      href: "/approvals",
    },
    {
      label: "Outstanding invoices",
      value: money(outstanding),
      detail: `${data.invoices.filter((invoice) => invoice.status !== "PAID").length} invoices to follow up`,
      icon: FileCheck2,
      href: "/invoices",
    },
  ];
  return (
    <>
      <PageHeader
        title="Overview"
        description={`Welcome back, ${data.actor.name.split(" ")[0]}. Here's where your business stands today.`}
        actions={
          can(data.actor.role, "quoteWrite") && (
            <Button nativeButton={false} size="lg" render={<Link href="/quotations/new" />}>
              <Plus />
              Create quotation
            </Button>
          )
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="bg-gradient-to-t from-primary/5 to-card">
            <CardHeader>
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="text-3xl font-semibold tracking-tight tabular-nums">
                {metric.value}
              </CardTitle>
              <CardAction>
                <metric.icon className="size-5 text-muted-foreground" />
              </CardAction>
            </CardHeader>
            <CardFooter className="justify-between gap-2 text-xs">
              <span>{metric.detail}</span>
              {can(data.actor.role, metric.href.slice(1) as Permission) && (
                <Button
                  nativeButton={false}
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`View ${metric.label.toLowerCase()}`}
                  render={<Link href={metric.href} />}
                >
                  <ArrowUpRight />
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(260px,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Recent quotations</CardTitle>
            <CardDescription>Your latest conversations, moving toward a close.</CardDescription>
            <CardAction>
              <Button
                nativeButton={false}
                variant="ghost"
                size="sm"
                render={<Link href="/quotations" />}
              >
                View all <ArrowRight />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <DataTable
              toolbar={(_table, extras) => <>{extras.bulkRemove}</>}
              columns={quoteColumns}
              data={recentQuotes}
              getRowId={(row) => row.id}
              onRowClick={(row) => router.push(`/quotations/${row.id}`)}
              showPagination={false}
              enableColumnResizing={false}
              emptyMessage="No quotations yet. Create your first quotation to start the conversation."
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Deal momentum</CardTitle>
            <CardDescription>A clear view of your quote-to-cash journey.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {[
              { label: "Quotations created", count: data.quotes.length },
              {
                label: "Approved or sent",
                count: data.quotes.filter((quote) =>
                  ["APPROVED", "SENT", "CONFIRMED"].includes(quote.status),
                ).length,
              },
              { label: "Confirmed deals", count: confirmed.length },
              {
                label: "Orders shipped",
                count: data.orders.filter((order) => order.fulfillmentStatus === "FULFILLED")
                  .length,
              },
            ].map((stage) => (
              <div key={stage.label} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{stage.label}</span>
                  <span className="font-medium tabular-nums">{stage.count}</span>
                </div>
                <Progress
                  aria-label={stage.label}
                  value={
                    data.quotes.length ? Math.min(100, (stage.count / data.quotes.length) * 100) : 0
                  }
                />
              </div>
            ))}
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            Conversion:{" "}
            {data.quotes.length ? Math.round((confirmed.length / data.quotes.length) * 100) : 0}% of
            quotations confirmed
          </CardFooter>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Needs your attention</CardTitle>
            <CardDescription>Focus on the next useful action.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              {
                label: "Review discount approvals",
                detail: `${pendingQuotes.length} quotation${pendingQuotes.length === 1 ? "" : "s"} waiting for a decision`,
                href: "/approvals",
              },
              {
                label: "Prepare orders for delivery",
                detail: `${data.orders.filter((order) => order.fulfillmentStatus !== "FULFILLED").length} orders in fulfillment`,
                href: "/fulfillment",
              },
              {
                label: "Follow up on receivables",
                detail: `${money(outstanding)} remains outstanding`,
                href: "/invoices",
              },
            ]
              .filter((item) => can(data.actor.role, item.href.slice(1) as Permission))
              .map((item) => (
                <div key={item.href} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <Button
                    nativeButton={false}
                    variant="outline"
                    size="icon-sm"
                    aria-label={item.label}
                    render={<Link href={item.href} />}
                  >
                    <ArrowRight />
                  </Button>
                </div>
              ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Activity feed</CardTitle>
            <CardDescription>The latest changes across your workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.activity.slice(0, 4).map((entry, index) => (
              <div key={entry.id}>
                {index > 0 && <Separator className="mb-3" />}
                <div className="flex justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{displayStatus(entry.action)}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.actorName}
                      {entry.reason ? ` · ${entry.reason}` : ""}
                    </p>
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {displayDate(entry.createdAt)}
                  </time>
                </div>
              </div>
            ))}
            {!data.activity.length && (
              <p className="py-4 text-sm text-muted-foreground">
                Your workspace activity will appear here.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
