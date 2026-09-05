import type { ReactNode } from "react";

import type { dataTableFeatures } from "@/components/ui/data-table/features";

export type DataTableApplyCellToAllRowsArgs<TData> = {
  columnId: string;
  sourceRow: TData;
  sourceRowIndex: number;
  value: unknown;
};

export type DataTableBulkRemoveCopy = {
  archiveDisabled?: boolean;
  archiveLabel?: string;
  deleteLabel?: string;
  description: ReactNode;
  impactFooter?: ReactNode;
  impactRows?: DataTableBulkRemoveImpactRow[];
  impactTitle?: string;
  title: string;
};

export type DataTableBulkRemoveHandlers<TData> = {
  bulkRemovePending?: boolean;
  enableBulkRemove?: boolean;
  getBulkRemoveCopy?: (rows: TData[]) => DataTableBulkRemoveCopy;
  onBulkArchive?: (rows: TData[]) => boolean | void | Promise<boolean | void>;
  onBulkDelete?: (rows: TData[]) => boolean | void | Promise<boolean | void>;
};

export type DataTableBulkRemoveImpactRow = {
  count: number;
  label: string;
};

export type DataTableColumnApplyToAllMeta<TData> = {
  /** Label for aria/title; falls back to `meta.label` then column id. */
  fieldLabel?: string;
  /** Read the value to propagate from the source row. */
  getValue: (row: TData) => unknown;
};

/**
 * Shape of `ColumnDef.meta` for admin DataTable columns. Every field is optional —
 * set only the ones a given column needs.
 */
export type DataTableColumnMeta<TData> = {
  /** When set with `onApplyCellToAllRows` on DataTable, shows a row-hover apply icon. */
  applyToAll?: DataTableColumnApplyToAllMeta<TData>;
  /** Return the raw value to copy for this cell (independent of what the cell renders). */
  copyValue?: (row: TData) => string;
  /** Column display label used by the view-options toggle. */
  label?: string;
  /** Pin this column to an edge of the table during horizontal scroll. */
  sticky?: "left" | "right";
};

/** Derived from the runtime feature registration in `data-table/features.ts`. */
export type DataTableFeatures = typeof dataTableFeatures;

export type DataTableToolbarExtras = {
  bulkRemove: ReactNode;
};
