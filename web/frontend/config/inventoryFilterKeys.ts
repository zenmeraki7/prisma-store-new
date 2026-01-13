// web/frontend/src/config/inventoryFilterKeys.ts

/**
 * Inventory filter keys are always:
 * inventory.<locationId>
 *
 * NOTE:
 * These keys are VALID ONLY in POST-SELECTION execution.
 * They MUST NOT be compiled into Shopify product search.
 */
export type InventoryLocationKey =
  `inventory.${string}`;
