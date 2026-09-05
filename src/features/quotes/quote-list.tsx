"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { quoteColumns } from "@/features/quotes/quote-columns";
import { money } from "@/features/quotes/rules";
import { PageHeader } from "@/features/shell/page-header";
import { useWorkspace } from "@/features/shell/use-workspace";
import { WorkspaceState } from "@/features/shell/workspace-state";

const stages = [
  { label: "Draft", statuses: ["DRAFT", "RETURNED"] },
  { label: "In approval", statuses: ["PENDING_APPROVAL"] },
  { label: "Approved", statuses: ["APPROVED"] },
  { label: "Negotiation", statuses: ["SENT", "UNDER_NEGOTIATION"] },
  { label: "Confirmed", statuses: ["CONFIRMED"] },
];

export function QuoteList({ approvals = false }: { approvals?: boolean }) {
  const { data, error, mutate } = useWorkspace();
  const [search, setSearch] = useState("");
  const router = useRouter();
  if (!data) return <WorkspaceState error={error} retry={() => void mutate()} />;
  const visible = data.quotes.filter(
    (q) =>
      (!approvals || q.status !== "DRAFT") &&
      `${q.number} ${data.customers.find((c) => c.id === q.customerId)?.name ?? ""} ${q.status}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const canCreate = ["rep", "manager", "admin"].includes(data.actor.role);
  const tableRows = visible.map((quote) => ({
    ...quote,
    customerName:
      data.customers.find((customer) => customer.id === quote.customerId)?.name ?? "Customer",
  }));
  return (
    <>
      <PageHeader
        title={approvals ? "Approval center" : "Quotations"}
        description={
          approvals
            ? "The right decision, with every reason in view. Review the current step and preserve the audit trail."
            : "From first conversation to a confirmed deal. Your pipeline, pricing and next steps in one place."
        }
        actions={
          canCreate && !approvals ? (
            <Button nativeButton={false} render={<Link href="/quotations/new" />}>
              <Plus data-icon="inline-start" />
              New quotation
            </Button>
          ) : undefined
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "Open pipeline",
            value: money(
              data.quotes
                .filter((q) => !["CONFIRMED", "REJECTED"].includes(q.status))
                .reduce((sum, q) => sum + q.totalCents, 0),
            ),
          },
          {
            title: "Waiting for approval",
            value: String(data.quotes.filter((q) => q.status === "PENDING_APPROVAL").length),
          },
          {
            title: "Confirmed deals",
            value: String(data.quotes.filter((q) => q.status === "CONFIRMED").length),
          },
        ].map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <CardDescription>{item.title}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{item.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <Tabs defaultValue={approvals ? "table" : "board"}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="table">Table</TabsTrigger>
          </TabsList>
          <Input
            aria-label="Search quotations"
            placeholder="Search customer, quotation or stage…"
            className="sm:max-w-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <TabsContent value="board">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {stages.map((stage) => {
              const rows = visible.filter((q) => stage.statuses.includes(q.status));
              return (
                <Card key={stage.label} className="bg-muted/30">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-sm">
                      {stage.label}
                      <Badge variant="outline">{rows.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {rows.map((q) => (
                      <Card key={q.id} className="shadow-none">
                        <CardHeader className="gap-2">
                          <CardDescription className="text-xs">{q.number}</CardDescription>
                          <CardTitle className="text-sm">
                            {data.customers.find((c) => c.id === q.customerId)?.name}
                          </CardTitle>
                          <p className="text-lg font-semibold tabular-nums">
                            {money(q.totalCents)}
                          </p>
                          <div className="flex items-center justify-between">
                            <Badge variant={q.risk === "HIGH" ? "destructive" : "secondary"}>
                              {q.risk === "NONE" ? "Within policy" : `${q.risk} risk`}
                            </Badge>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              nativeButton={false}
                              render={
                                <Link
                                  aria-label={`Open ${q.number}`}
                                  href={`/quotations/${q.id}`}
                                />
                              }
                            >
                              <ArrowUpRight />
                            </Button>
                          </div>
                        </CardHeader>
                      </Card>
                    ))}
                    {!rows.length && (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        No deals in this stage
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
        <TabsContent value="table">
          <Card>
            <CardContent>
              <DataTable
                columns={quoteColumns}
                data={tableRows}
                getRowId={(q) => q.id}
                onRowClick={(q) => router.push(`/quotations/${q.id}`)}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
