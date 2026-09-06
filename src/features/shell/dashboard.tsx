"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";

import { CountValue } from "@/components/editorial/count-value";
import { eyebrowType } from "@/components/editorial/editorial";
import type { DataTableFeatures } from "@/components/ui/_types/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DataTableClassNames } from "@/components/ui/data-table";
import { DataTable } from "@/components/ui/data-table";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { displayDate, displayStatus, money } from "@/features/shell/format";
import { PageHeader } from "@/features/shell/page-header";
import { useWorkspace } from "@/features/shell/use-workspace";
import { WorkspaceState } from "@/features/shell/workspace-state";
import type { Permission } from "@/lib/domain/_types/permissions";
import type { Workspace } from "@/lib/domain/_types/workspace";
import { can } from "@/lib/domain/permissions";
import { cn } from "@/lib/utils";

/**
 * Overview reads as the masthead of the workspace: the four numbers that decide the day sit in a
 * hairline-divided figure band, and everything below is a numbered section rule. Hierarchy comes
 * from rules, spacing and type scale — no cards, no pills, no icon per tile.
 */

/** Numbered section rule. The number carries the rhythm; the title stays quiet. */
function SectionHead({
  action,
  children,
  index,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  index: string;
  title: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-b border-border-strong pb-3">
      <h2 className={cn(eyebrowType, "flex items-baseline gap-3 text-muted-foreground")}>
        <span className="text-foreground tabular-nums">{index}</span>
        <span aria-hidden className="h-px w-6 self-center bg-border-strong" />
        {title}
      </h2>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p className="text-xs text-muted-foreground">{children}</p>
        {action}
      </div>
    </div>
  );
}

/**
 * A summary figure. The number is the primary visual element; the label recedes to an eyebrow and
 * carries the route link when the viewer's role may open it, so the band needs no arrow buttons.
 */
function Figure({
  accent,
  href,
  label,
  note,
  value,
}: {
  accent: boolean;
  href?: string;
  label: string;
  note: string;
  value: ReactNode;
}) {
  return (
    <div className="py-7 sm:px-8 sm:first:pl-0 sm:last:pr-0">
      <span
        aria-hidden
        className={cn("mb-4 block h-0.5 w-7", accent ? "bg-ink-accent" : "bg-transparent")}
      />
      <dt className={cn(eyebrowType, "text-muted-foreground")}>
        {href ? (
          <Button
            nativeButton={false}
            variant="link"
            aria-label={`View ${label.toLowerCase()}`}
            render={<Link href={href} />}
            className="h-auto px-0 text-[0.6875rem] leading-none font-medium tracking-[0.16em] text-muted-foreground uppercase hover:text-foreground"
          >
            {label}
          </Button>
        ) : (
          label
        )}
      </dt>
      <dd className="mt-3 text-[1.75rem] leading-none font-medium tracking-tight text-foreground tabular-nums">
        {value}
      </dd>
      <p className="mt-3 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

type QuoteRow = Workspace["quotes"][number] & { customerName: string };

/**
 * The shared DataTable keeps sorting and keyboard-accessible rows; its box, padding and rounded
 * chrome give way to a rule under letterspaced headers and a hairline row rhythm.
 */
const quotationStyles: DataTableClassNames = {
  cell: "border-b border-border px-0 py-3.5 pr-8 align-middle last:pr-0",
  container: "rounded-none border-0",
  emptyCell: "border-b border-border px-0 text-left whitespace-normal text-muted-foreground",
  head: "h-auto px-0 pr-8 pb-2.5 last:pr-0",
  row: "border-0 hover:bg-muted/40",
  table: "text-[0.8125rem]",
};

const quoteColumns: ColumnDef<DataTableFeatures, QuoteRow>[] = [
  {
    accessorKey: "number",
    header: "Quotation",
    cell: ({ row }) => (
      <Link
        className="font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        href={`/quotations/${row.original.id}`}
      >
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
    header: () => <span className="block text-right">Value</span>,
    cell: ({ row }) => (
      <span className="block text-right font-medium text-foreground tabular-nums">
        {money(row.original.totalCents)}
      </span>
    ),
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
      value: (
        <CountValue currency value={openQuotes.reduce((sum, quote) => sum + quote.totalCents, 0)} />
      ),
      detail: `${openQuotes.length} active quotations`,
      href: "/quotations",
    },
    {
      label: "Monthly recurring revenue",
      value: <CountValue currency value={monthlyRevenue} />,
      detail: `${activeSubscriptions.length} active subscriptions · before tax`,
      href: "/subscriptions",
    },
    {
      label: "Awaiting approval",
      value: <CountValue value={pendingQuotes.length} />,
      detail: "Decisions that keep deals moving",
      href: "/approvals",
    },
    {
      label: "Outstanding invoices",
      value: <CountValue currency value={outstanding} />,
      detail: `${data.invoices.filter((invoice) => invoice.status !== "PAID").length} invoices to follow up`,
      href: "/invoices",
    },
  ];
  const stages = [
    { label: "Quotations created", count: data.quotes.length },
    {
      label: "Approved or sent",
      count: data.quotes.filter((quote) => ["APPROVED", "SENT", "CONFIRMED"].includes(quote.status))
        .length,
    },
    { label: "Confirmed deals", count: confirmed.length },
    {
      label: "Orders shipped",
      count: data.orders.filter((order) => order.fulfillmentStatus === "FULFILLED").length,
    },
  ];
  const attention = [
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
  ].filter((item) => can(data.actor.role, item.href.slice(1) as Permission));
  return (
    <div className="mx-auto w-full max-w-300 pb-6">
      <PageHeader
        title="Overview"
        description={`Welcome back, ${data.actor.name.split(" ")[0]}. Here's where your business stands today.`}
        actions={
          can(data.actor.role, "quoteWrite") && (
            <Button nativeButton={false} size="lg" render={<Link href="/quotations/new" />}>
              Create quotation
            </Button>
          )
        }
      />

      <section className="mt-10 border-t border-border">
        <dl className="grid grid-cols-2 gap-x-10 sm:grid-cols-4 sm:gap-x-0 sm:divide-x sm:divide-border">
          {metrics.map((metric, index) => (
            <Figure
              key={metric.label}
              accent={index === 0}
              href={
                can(data.actor.role, metric.href.slice(1) as Permission) ? metric.href : undefined
              }
              label={metric.label}
              note={metric.detail}
              value={metric.value}
            />
          ))}
        </dl>
      </section>

      <section className="mt-14">
        <SectionHead
          index="01"
          title="Recent quotations"
          action={
            <Button
              nativeButton={false}
              variant="link"
              size="sm"
              render={<Link href="/quotations" />}
              className="h-auto px-0"
            >
              View all
            </Button>
          }
        >
          Your latest conversations, moving toward a close.
        </SectionHead>
        <div className="mt-4">
          <DataTable
            classNames={quotationStyles}
            toolbar={(_table, extras) => (
              <>
                {extras.bulkRemove}
                {extras.pageNav ? (
                  <div className="flex items-center justify-end">{extras.pageNav}</div>
                ) : null}
              </>
            )}
            columns={quoteColumns}
            data={recentQuotes}
            getRowId={(row) => row.id}
            onRowClick={(row) => router.push(`/quotations/${row.id}`)}
            showPagination={false}
            enableColumnResizing={false}
            emptyMessage="No quotations yet. Create your first quotation to start the conversation."
          />
        </div>
      </section>

      <div className="mt-14 grid gap-y-14 lg:grid-cols-2 lg:divide-x lg:divide-border">
        <section className="lg:pr-12">
          <SectionHead index="02" title="Deal momentum">
            A clear view of your quote-to-cash journey.
          </SectionHead>
          <ul className="mt-6 space-y-5">
            {stages.map((stage) => (
              <li key={stage.label}>
                <Progress
                  aria-label={stage.label}
                  getAriaValueText={() => String(stage.count)}
                  value={
                    data.quotes.length ? Math.min(100, (stage.count / data.quotes.length) * 100) : 0
                  }
                >
                  <ProgressLabel>{stage.label}</ProgressLabel>
                  <ProgressValue>{() => stage.count}</ProgressValue>
                </Progress>
              </li>
            ))}
          </ul>
          <p className="mt-6 border-t border-border pt-3 text-xs text-muted-foreground">
            Conversion:{" "}
            {data.quotes.length ? Math.round((confirmed.length / data.quotes.length) * 100) : 0}% of
            quotations confirmed
          </p>
        </section>

        <section className="lg:pl-12">
          <SectionHead index="03" title="Needs your attention">
            Focus on the next useful action.
          </SectionHead>
          <ul className="mt-2">
            {attention.map((item) => (
              <li key={item.href} className="border-b border-border py-4 last:border-0">
                <Button
                  nativeButton={false}
                  variant="link"
                  aria-label={item.label}
                  render={<Link href={item.href} />}
                  className="h-auto justify-start px-0 text-sm"
                >
                  {item.label}
                </Button>
                <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-14">
        <SectionHead index="04" title="Activity feed">
          The latest changes across your workspace.
        </SectionHead>
        <ul className="mt-2">
          {data.activity.slice(0, 4).map((entry) => (
            <li
              key={entry.id}
              className="flex gap-4 border-b border-border py-4 last:border-0 sm:gap-6"
            >
              <span aria-hidden className="mt-1.5 size-1.5 shrink-0 bg-border-strong" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">{displayStatus(entry.action)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {entry.actorName}
                  {entry.reason ? ` · ${entry.reason}` : ""}
                </p>
              </div>
              <time className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {displayDate(entry.createdAt)}
              </time>
            </li>
          ))}
        </ul>
        {!data.activity.length && (
          <p className="py-4 text-sm text-muted-foreground">
            Your workspace activity will appear here.
          </p>
        )}
      </section>
    </div>
  );
}
