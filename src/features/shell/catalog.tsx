"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";

import type { DataTableFeatures } from "@/components/ui/_types/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, DataTableDefaultToolbar } from "@/components/ui/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CatalogEditor } from "@/features/shell/catalog-editor";
import { money } from "@/features/shell/format";
import { PageHeader } from "@/features/shell/page-header";
import { useWorkspace } from "@/features/shell/use-workspace";
import { WorkspaceState } from "@/features/shell/workspace-state";
import type { Workspace } from "@/lib/domain/_types/workspace";

type Product = Workspace["products"][number];
type Customer = Workspace["customers"][number];
const productColumns: ColumnDef<DataTableFeatures, Product>[] = [
  {
    accessorKey: "name",
    header: "Product",
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.name}</p>
        <p className="text-xs text-muted-foreground">{row.original.variant}</p>
      </div>
    ),
  },
  { accessorKey: "category", header: "Category" },
  {
    accessorKey: "priceCents",
    header: "Unit price",
    cell: ({ row }) => money(row.original.priceCents),
  },
  {
    accessorKey: "intervalMonths",
    header: "Billing",
    cell: ({ row }) =>
      row.original.intervalMonths ? `Every ${row.original.intervalMonths} month(s)` : "One-time",
  },
  {
    accessorKey: "active",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.original.active ? "default" : "secondary"}>
        {row.original.active ? "Active" : "Inactive"}
      </Badge>
    ),
  },
];
const customerColumns: ColumnDef<DataTableFeatures, Customer>[] = [
  { accessorKey: "name", header: "Customer" },
  { accessorKey: "email", header: "Email" },
  {
    accessorKey: "tier",
    header: "Tier",
    cell: ({ row }) => <Badge variant="outline">{row.original.tier}</Badge>,
  },
  { accessorKey: "team", header: "Team" },
];

export function Catalog() {
  const { data, error, mutate } = useWorkspace();
  const [editor, setEditor] = useState<{
    kind: "product" | "customer";
    product?: Product;
    customer?: Customer;
  } | null>(null);
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
  const canEditCustomer = ["admin", "manager"].includes(data.actor.role);
  return (
    <>
      <PageHeader
        title="Product catalog"
        description="The products, services, and customers behind every great deal."
      />
      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Products · {data.products.length}</TabsTrigger>
          <TabsTrigger value="customers">Customers · {data.customers.length}</TabsTrigger>
        </TabsList>
        <TabsContent value="products">
          <Card>
            <CardContent>
              <DataTable
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
                onRowClick={
                  canEdit ? (product) => setEditor({ kind: "product", product }) : undefined
                }
                emptyMessage="No products yet. Add your first product to start quoting."
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="customers">
          <Card>
            <CardContent>
              <DataTable
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
                        {["admin", "manager", "rep"].includes(data.actor.role) ? (
                          <Button onClick={() => setEditor({ kind: "customer" })}>
                            <Plus />
                            Add customer
                          </Button>
                        ) : null}
                      </>
                    }
                  />
                )}
                columns={customerColumns}
                data={data.customers}
                getRowId={(row) => row.id}
                onRowClick={
                  canEditCustomer
                    ? (customer) => setEditor({ kind: "customer", customer })
                    : undefined
                }
                emptyMessage="No customers yet."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {editor && <CatalogEditor {...editor} close={() => setEditor(null)} saved={mutate} />}
    </>
  );
}
