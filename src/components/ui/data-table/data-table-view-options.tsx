"use client";

import { type RowData, type Table } from "@tanstack/react-table";
import { Settings2 } from "lucide-react";

import type { DataTableFeatures } from "@/components/ui/_types/data-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function DataTableViewOptions<TData extends RowData>({
  table,
}: {
  table: Table<DataTableFeatures, TData>;
}) {
  "use no memo";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="h-8" />}>
        <Settings2 aria-hidden="true" className="size-4" />
        View
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-37.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {table
            .getAllColumns()
            .filter((column) => typeof column.accessorFn !== "undefined" && column.getCanHide())
            .map((column) => {
              return (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {column.id}
                </DropdownMenuCheckboxItem>
              );
            })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
