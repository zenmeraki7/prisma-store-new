// web/frontend/src/config/inventoryFilterFields.ts
import type { FilterFieldDef } from "./filterFields";
import type { InventoryLocationKey } from "./inventoryFilterKeys";

/**
 * Inventory filters are POST-SELECTION ONLY.
 * They are resolved via Bulk API / target resolution.
 */
export interface InventoryLocationFilterField
  extends FilterFieldDef {
  scope: "inventory";
  executionPhase: "post_selection";
  key: InventoryLocationKey;
}

export const INVENTORY_LOCATION_FILTERS = (
  locations: {
    id: string;
    name: string;
  }[] = []
): readonly InventoryLocationFilterField[] =>
  locations.map(location => ({
    key: `inventory.${location.id}`,
    label: `Inventory at ${location.name}`,
    scope: "inventory",
    executionPhase: "post_selection",
    valueType: "number",
    operators: ["gt", "lt", "between"],
  }));

