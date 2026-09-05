# Shared DataTable

Use `@/components/ui/data-table` for application list/table screens. Raw shadcn table primitives are
for small static summaries only. Keep entity columns and toolbars near the owning feature while the
generic mechanics remain in the shared component.

## Included features

- TanStack Table v9 explicit feature registration
- Sorting, column filters, faceted filters, visibility, resizing, and sticky left/right columns
- Client pagination for small bounded arrays and controlled manual pagination for server-backed lists
- Stable row selection with bulk archive/delete confirmation
- Copy-cell and apply-cell-value-to-all actions
- Search/reset/default toolbar slots and custom toolbar composition
- Clickable keyboard-accessible rows, empty states, page-size controls, and selection summaries

## Required usage

- Every selectable table MUST pass a stable `getRowId`; array indexes can retarget selection after
  refresh/reorder.
- Server-backed lists MUST use `manualPagination`, controlled `pagination`, `pageCount`, and
  `onPaginationChange`. Reset page index when sorting or filtering changes.
- Build the SWR key from the full server query contract—resource, pagination, sorting, and filters—so
  caches cannot alias different table views. Keep the previous page visible during revalidation.
- Column definitions and every dependency used to build them MUST be referentially stable. Recreating
  cell functions remounts editable cells and loses focus.
- Sticky columns use `meta.sticky: "left" | "right"`; `meta.copyValue` and `meta.applyToAll` add shared
  cell actions without reimplementing buttons.
- A custom toolbar MUST render `extras.bulkRemove`; otherwise selection works but its action silently
  disappears.
- Selection with bulk removal requires `onBulkDelete`; return `false` to retain selection after a
  total failure. Successful handlers reset selection.
- Form-embedded tables SHOULD hide pagination and use `DataTableEditableCellActions` with live form
  values rather than stale row snapshots.
