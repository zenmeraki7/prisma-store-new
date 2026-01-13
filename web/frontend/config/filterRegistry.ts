// web/frontend/src/config/filterRegistry.ts

import type { FilterFieldDef } from "./filterFields";
import {
  PRODUCT_FILTER_FIELDS,
} from "./productFilterFields";
import {
  VARIANT_FILTER_FIELDS,
} from "./variantFilterFields";
import {
  INVENTORY_LOCATION_FILTERS,
} from "./inventoryFilterFields";

/* ------------------------------------------------------------------ */
/* Execution Phase                                                    */
/* ------------------------------------------------------------------ */

export type ExecutionPhase =
  | "search"          // Shopify product search
  | "post_selection"; // Bulk API / background workers

/* ------------------------------------------------------------------ */
/* Registry Entry                                                     */
/* ------------------------------------------------------------------ */

export interface FilterRegistryEntry {
  fields: readonly FilterFieldDef[];
  executionPhase: ExecutionPhase;
}

/* ------------------------------------------------------------------ */
/* Unified Filter Registry (Execution-Aware)                           */
/* ------------------------------------------------------------------ */

export const buildFilterRegistry = (
  locations: { id: string; name: string }[]
): {
  product: FilterRegistryEntry;
  variant: FilterRegistryEntry;
  inventory: FilterRegistryEntry;
} => ({
  product: {
    fields: PRODUCT_FILTER_FIELDS,
    executionPhase: "search",
  },

  variant: {
    fields: VARIANT_FILTER_FIELDS,
    executionPhase: "post_selection",
  },

  inventory: {
    fields: INVENTORY_LOCATION_FILTERS(locations),
    executionPhase: "post_selection",
  },
});
