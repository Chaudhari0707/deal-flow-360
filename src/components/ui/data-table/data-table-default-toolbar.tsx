"use client";

import * as React from "react";
import { type RowData, type Table } from "@tanstack/react-table";
import { SlidersHorizontal } from "lucide-react";

import { eyebrowType } from "@/components/editorial/editorial";
import type { DataTableFeatures } from "@/components/ui/_types/data-table";
import { Button } from "@/components/ui/button";
import { DataTableViewOptions } from "@/components/ui/data-table/data-table-view-options";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Quiet label type for the shared table chrome. Labels recede through size, weight, case and
 * letter-spacing — never through transparency, which cannot hold AAA in the light theme.
 */

interface DataTableDefaultToolbarProps<TData extends RowData> {
  table: Table<DataTableFeatures, TData>;
  /**
   * Column accessor key to attach the search filter to.
   * Omit or set undefined to hide the search input entirely.
   */
  searchColumn?: string;
  /** Accessible name for the search input. Defaults to `searchPlaceholder`. */
  searchLabel?: string;
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
  /** Card title shown on the same row as View. */
  title?: React.ReactNode;
  /** Supporting text under the title. */
  description?: React.ReactNode;
}

export function DataTableDefaultToolbar<TData extends RowData>({
  table,
  searchColumn,
  searchLabel,
  searchPlaceholder = "Search…",
  searchValue,
  onSearchValueChange,
  showViewOptions = true,
  filters,
  actions,
  title,
  description,
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

  const hasMasthead = Boolean(title || description);
  const hasActions = Boolean(actions) || showViewOptions;
  const hasSearch = Boolean(columnSearchId || onSearchValueChange);
  const hasControls = hasSearch || Boolean(filters) || isFiltered;

  return (
    <div className="flex flex-col gap-4">
      {(hasMasthead || hasActions) && (
        <div
          className={cn(
            "flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3",
            // A firm section rule under the masthead, lighter hairlines inside the table below.
            hasMasthead && "border-b border-border-strong pb-3",
          )}
        >
          {hasMasthead ? (
            <div className="min-w-0 flex-1">
              {title ? <div className={cn(eyebrowType, "text-foreground")}>{title}</div> : null}
              {description ? (
                <p className="mt-2 max-w-[68ch] text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
          ) : null}
          {hasActions ? (
            <div className="ml-auto flex shrink-0 items-center gap-3">
              {actions}
              {showViewOptions && <DataTableViewOptions table={table} />}
            </div>
          ) : null}
        </div>
      )}
      {hasControls && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {hasSearch && (
            /* Refinement lives inside the search field rather than in a row of its own: the
               field is the one place a reader already looks to narrow a list. */
            <div className="flex w-full max-w-sm items-center border-b-2 border-border-strong focus-within:border-ink-accent">
              <Input
                aria-label={searchLabel ?? searchPlaceholder}
                placeholder={searchPlaceholder}
                value={resolvedSearchValue}
                onChange={(e) => {
                  if (onSearchValueChange) {
                    onSearchValueChange(e.target.value);
                    return;
                  }

                  table.getColumn(columnSearchId!)?.setFilterValue(e.target.value);
                }}
                className="h-9 min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 text-sm focus-visible:border-0 focus-visible:ring-0"
              />
              {filters ? (
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Refine search"
                        className="shrink-0 rounded-none text-muted-foreground hover:bg-transparent hover:text-foreground"
                      />
                    }
                  >
                    <SlidersHorizontal />
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-104 max-w-[calc(100vw-2rem)] p-0">
                    <div className="grid gap-4 p-5">{filters}</div>
                    {isFiltered && (
                      <div className="flex justify-end border-t border-border px-5 py-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={cn(eyebrowType, "rounded-none")}
                          onClick={() => {
                            table.resetColumnFilters();
                            onSearchValueChange?.("");
                          }}
                        >
                          Reset
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              ) : null}
            </div>
          )}
          {!hasSearch && filters}
          {isFiltered && !filters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                eyebrowType,
                "h-auto rounded-none px-0 py-1 text-muted-foreground underline decoration-border-strong underline-offset-4 hover:bg-transparent hover:text-foreground hover:decoration-foreground",
              )}
              onClick={() => {
                table.resetColumnFilters();
                onSearchValueChange?.("");
              }}
            >
              Reset
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
