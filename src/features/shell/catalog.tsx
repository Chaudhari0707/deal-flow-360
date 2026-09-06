"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";

import type { DataTableClassNames, DataTableFeatures } from "@/components/ui/_types/data-table";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableDefaultToolbar } from "@/components/ui/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CatalogEditor } from "@/features/shell/catalog-editor";
import { money } from "@/features/shell/format";
import { PageHeader } from "@/features/shell/page-header";
import { useWorkspace } from "@/features/shell/use-workspace";
import { WorkspaceState } from "@/features/shell/workspace-state";
import { HttpResponseError } from "@/lib/api/client";
import type { Workspace } from "@/lib/domain/_types/workspace";
import { can } from "@/lib/domain/permissions";
import { cn } from "@/lib/utils";

type Product = Workspace["products"][number];
type Customer = Workspace["customers"][number];

/**
 * The register carries no outer box: the shared table primitive already supplies letterspaced
 * headers over a rule and hairline rows, so the screen only removes the container chrome and
 * pulls the first and last columns onto the page's own margin.
 */
const registerStyles: DataTableClassNames = {
  cell: "px-0 pr-8 last:pr-0",
  container: "rounded-none border-0",
  emptyCell: "px-0 text-muted-foreground",
  head: "px-0 pr-8 last:pr-0",
};

/** State is a square marker plus text, never a coloured pill. */
function StatusMark({ label, live }: { label: string; live: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span
        aria-hidden
        className={cn("size-1.5 shrink-0", live ? "bg-ink-accent" : "bg-foreground/40")}
      />
      <span className={live ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </span>
  );
}

const productColumns: ColumnDef<DataTableFeatures, Product>[] = [
  {
    accessorKey: "name",
    header: "Product",
    cell: ({ row }) => (
      <span className="block">
        <span className="block font-medium text-foreground">{row.original.name}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{row.original.variant}</span>
      </span>
    ),
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.category}</span>,
  },
  {
    accessorKey: "priceCents",
    header: () => <span className="block text-right">Unit price</span>,
    cell: ({ row }) => (
      <span className="block text-right font-medium text-foreground tabular-nums">
        {money(row.original.priceCents)}
      </span>
    ),
  },
  {
    accessorKey: "intervalMonths",
    header: "Billing",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.intervalMonths ? `Every ${row.original.intervalMonths} month(s)` : "One-time"}
      </span>
    ),
  },
  {
    accessorKey: "active",
    header: "Status",
    cell: ({ row }) => (
      <StatusMark live={row.original.active} label={row.original.active ? "Active" : "Inactive"} />
    ),
  },
];

const customerColumns: ColumnDef<DataTableFeatures, Customer>[] = [
  {
    accessorKey: "name",
    header: "Customer",
    cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.email}</span>,
  },
  {
    accessorKey: "tier",
    header: "Tier",
    cell: ({ row }) => <span className="text-foreground">{row.original.tier}</span>,
  },
  {
    accessorKey: "team",
    header: "Team",
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.team}</span>,
  },
];

export function Catalog({ customersOnly = false }: { customersOnly?: boolean }) {
  const { data, error, mutate } = useWorkspace();
  const [editor, setEditor] = useState<{
    kind: "product" | "customer";
    product?: Product;
    customer?: Customer;
  } | null>(null);
  const canEditCustomer = ["admin", "manager"].includes(data?.actor.role ?? "");
  const directoryColumns = useMemo<ColumnDef<DataTableFeatures, Customer>[]>(
    () =>
      canEditCustomer
        ? [
            ...customerColumns,
            {
              id: "actions",
              header: () => <span className="block text-right">Actions</span>,
              cell: ({ row }) => (
                <span className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto rounded-none px-0 py-1 text-xs text-muted-foreground underline decoration-border-strong underline-offset-4 hover:bg-transparent hover:text-foreground hover:decoration-foreground"
                    onClick={(event) => {
                      event.stopPropagation();
                      setEditor({ kind: "customer", customer: row.original });
                    }}
                  >
                    Edit customer
                  </Button>
                </span>
              ),
            },
          ]
        : customerColumns,
    [canEditCustomer],
  );
  if (error || !data)
    return (
      <WorkspaceState
        error={error}
        retry={() => {
          void mutate();
        }}
      />
    );
  const canEdit = data.actor.role === "admin";
  if (customersOnly && !["rep", "manager", "admin"].includes(data.actor.role))
    return <WorkspaceState error={new HttpResponseError(403)} />;
  return (
    <>
      <PageHeader
        title={customersOnly ? "Customers" : "Product catalog"}
        description={
          customersOnly
            ? "Customer contact details and pricing tiers."
            : "The products, services, and customers behind every great deal."
        }
      />
      <Tabs defaultValue={customersOnly ? "customers" : "products"} className="gap-8">
        {!customersOnly && (
          <TabsList>
            <TabsTrigger value="products">Products · {data.products.length}</TabsTrigger>
            <TabsTrigger value="customers">Customers · {data.customers.length}</TabsTrigger>
          </TabsList>
        )}
        <TabsContent value="products">
          <DataTable
            classNames={registerStyles}
            toolbar={(table, extras) => (
              <DataTableDefaultToolbar
                table={table}
                title="Products & services"
                description={
                  canEdit
                    ? "Select a row to edit its pricing and availability."
                    : "Your current product and service price book."
                }
                searchColumn="name"
                searchPlaceholder="Search products…"
                actions={
                  <>
                    {extras.bulkRemove}
                    {canEdit ? (
                      <Button onClick={() => setEditor({ kind: "product" })}>
                        <Plus />
                        Add product
                      </Button>
                    ) : null}
                  </>
                }
              />
            )}
            columns={productColumns}
            data={data.products}
            getRowId={(row) => row.id}
            onRowClick={canEdit ? (product) => setEditor({ kind: "product", product }) : undefined}
            emptyMessage="No products yet. Add your first product to start quoting."
          />
        </TabsContent>
        <TabsContent value="customers">
          <DataTable
            classNames={registerStyles}
            toolbar={(table, extras) => (
              <DataTableDefaultToolbar
                table={table}
                title="Customer directory"
                description="Customer tiers guide your discount policy."
                searchColumn="name"
                searchPlaceholder="Search customers…"
                actions={
                  <>
                    {extras.bulkRemove}
                    {can(data.actor.role, "customerCreate") ? (
                      <Button onClick={() => setEditor({ kind: "customer" })}>
                        <Plus />
                        Add customer
                      </Button>
                    ) : null}
                  </>
                }
              />
            )}
            columns={directoryColumns}
            data={data.customers}
            getRowId={(row) => row.id}
            onRowClick={
              canEditCustomer ? (customer) => setEditor({ kind: "customer", customer }) : undefined
            }
            emptyMessage="No customers yet."
          />
        </TabsContent>
      </Tabs>
      {editor && <CatalogEditor {...editor} close={() => setEditor(null)} saved={mutate} />}
    </>
  );
}
