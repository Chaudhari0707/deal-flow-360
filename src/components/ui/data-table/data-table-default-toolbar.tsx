"use client";

import * as React from "react";
import { type RowData, type Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import type { DataTableFeatures } from "@/components/ui/_types/data-table";
import { Button } from "@/components/ui/button";
import { DataTableViewOptions } from "@/components/ui/data-table/data-table-view-options";
import { Input } from "@/components/ui/input";

interface DataTableDefaultToolbarProps<TData extends RowData> {
  table: Table<DataTableFeatures, TData>;
  /**
   * Column accessor key to attach the search filter to.
   * Omit or set undefined to hide the search input entirely.
   */
  searchColumn?: string;
  /** Placeholder shown inside the search input. Defaults to "Search…" */
  searchPlaceholder?: string;
  /** Optional external search value for server-backed filtering. */
  searchValue?: string;
  /** Optional external change handler for server-backed filtering. */
  onSearchValueChange?: (value: string) => void;
  /**
   * Show the column-visibility toggle (DataTableViewOptions).
   * Defaults to true — opt out by setting false.
   */
  showViewOptions?: boolean;
  /**
   * Slot for faceted filter chips or any other filter controls.
   * Rendered between the search input and the Reset button.
   */
  filters?: React.ReactNode;
  /**
   * Slot for right-side action elements (e.g. an "Add" button).
   * Rendered to the left of the view-options toggle.
   */
  actions?: React.ReactNode;
}

export function DataTableDefaultToolbar<TData extends RowData>({
  table,
  searchColumn,
  searchPlaceholder = "Search…",
  searchValue,
  onSearchValueChange,
  showViewOptions = true,
  filters,
  actions,
}: DataTableDefaultToolbarProps<TData>) {
  "use no memo";
  const isExternallyFiltered = Boolean(searchValue?.trim());
  const isFiltered = table.store.state.columnFilters.length > 0 || isExternallyFiltered;
  const columnSearchId = searchColumn?.trim() || undefined;
  const resolvedSearchValue =
    searchValue !== undefined
      ? searchValue
      : columnSearchId
        ? ((table.getColumn(columnSearchId)?.getFilterValue() as string | undefined) ?? "")
        : "";

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {columnSearchId && (
          <Input
            placeholder={searchPlaceholder}
            value={resolvedSearchValue}
            onChange={(e) => {
              if (onSearchValueChange) {
                onSearchValueChange(e.target.value);
                return;
              }

              table.getColumn(columnSearchId)?.setFilterValue(e.target.value);
            }}
            className="h-8 w-64"
          />
        )}
        {filters}
        {isFiltered && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => {
              table.resetColumnFilters();
              onSearchValueChange?.("");
            }}
          >
            Reset
            <X aria-hidden="true" className="ml-1 size-4" />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {showViewOptions && <DataTableViewOptions table={table} />}
      </div>
    </div>
  );
}
