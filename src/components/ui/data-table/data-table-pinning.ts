import type { CSSProperties } from "react";
import type { Column, RowData } from "@tanstack/react-table";

import type { DataTableFeatures } from "@/components/ui/_types/data-table";

/**
 * Sticky column pinning styles (TanStack column-pinning-sticky pattern).
 * Requires a single horizontal scroll ancestor and border-collapse: separate.
 */
export function getDataTablePinningStyles<TData extends RowData>(
  column: Column<DataTableFeatures, TData, unknown>,
): CSSProperties {
  const isPinned = column.getIsPinned();
  if (!isPinned) {
    return {};
  }

  const isLastStartPinnedColumn = isPinned === "start" && column.getIsLastColumn("start");
  const isFirstEndPinnedColumn = isPinned === "end" && column.getIsFirstColumn("end");

  return {
    boxShadow: isLastStartPinnedColumn
      ? "inset -8px 0 8px -8px rgb(0 0 0 / 0.14)"
      : isFirstEndPinnedColumn
        ? "inset 8px 0 8px -8px rgb(0 0 0 / 0.14)"
        : undefined,
    left: isPinned === "start" ? `${column.getStart("start")}px` : undefined,
    position: "sticky",
    right: isPinned === "end" ? `${column.getAfter("end")}px` : undefined,
    zIndex: isPinned === "end" ? 2 : 1,
  };
}

type ColumnPinningLike = {
  end?: string[];
  start?: string[];
};

/**
 * App-level column `meta.sticky` convention stays "left"/"right" (independent of
 * TanStack's public pinning API, which uses "start"/"end" as of v9).
 */
export function resolveInitialColumnPinning(columns: Array<{ id?: string; meta?: unknown }>): {
  end: string[];
  start: string[];
} {
  const start: string[] = [];
  const end: string[] = [];

  for (const column of columns) {
    const id = column.id;
    if (!id) continue;
    const sticky = (column.meta as { sticky?: "left" | "right" } | undefined)?.sticky;
    if (sticky === "left") start.push(id);
    if (sticky === "right") end.push(id);
  }

  return { end, start };
}

/** Stable key for sticky-meta-derived pinning (ignores unrelated column identity churn). */
export function columnPinningKey(pinning: ColumnPinningLike): string {
  const start = pinning.start ?? [];
  const end = pinning.end ?? [];
  return `${start.join("\0")}|\0|${end.join("\0")}`;
}

export function sameColumnPinning(start: ColumnPinningLike, end: ColumnPinningLike): boolean {
  return columnPinningKey(start) === columnPinningKey(end);
}
