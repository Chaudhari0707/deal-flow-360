export const ACTIVE_WAREHOUSE_LIMIT = 3;
export const ACTIVE_WAREHOUSE_LIMIT_MESSAGE =
  "Pause an existing warehouse first. The demo planner supports three active warehouses.";

export function wouldExceedActiveWarehouseLimit(
  warehouses: { active: boolean; id: string }[],
  warehouseId: string,
  nextActive: boolean,
) {
  return (
    nextActive &&
    warehouses.filter((row) => row.active && row.id !== warehouseId).length >=
      ACTIVE_WAREHOUSE_LIMIT
  );
}
