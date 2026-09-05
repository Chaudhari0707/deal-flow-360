"use client";

import type { ReactNode } from "react";

import { ApplyCellValueToAllButton } from "@/components/ui/data-table/apply-cell-value-to-all-button";

type DataTableEditableCellActionsProps = {
  children: ReactNode;
  disabled?: boolean;
  fieldLabel: string;
  onApplyToAll: () => void;
  showApplyToAll?: boolean;
};

/**
 * Wraps an editable cell input with the shared "apply to all rows" affordance.
 * Use inside form-embedded DataTables where the cell owns live RHF state — the
 * table-level auto-wrap reads row snapshots and is not sufficient on its own.
 */
export function DataTableEditableCellActions({
  children,
  disabled = false,
  fieldLabel,
  onApplyToAll,
  showApplyToAll = true,
}: DataTableEditableCellActionsProps) {
  return (
    <div className="flex min-w-0 items-center gap-0.5">
      <div className="min-w-0 flex-1">{children}</div>
      {showApplyToAll ? (
        <ApplyCellValueToAllButton
          disabled={disabled}
          fieldLabel={fieldLabel}
          onApply={onApplyToAll}
        />
      ) : null}
    </div>
  );
}
