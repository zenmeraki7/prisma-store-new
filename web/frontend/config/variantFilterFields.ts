// web/frontend/src/config/variantFilterFields.ts
import type { FilterFieldDef } from "./filterFields";

/**
 * ⚠️ VARIANT FILTERS — POST-SELECTION ONLY
 *
 * These fields MUST NOT be used in Shopify product search.
 * They are resolved ONLY during background target resolution
 * (Bulk API / variant pass).
 *
 * Frontend may collect them.
 * Search compiler MUST reject them.
 */

export const VARIANT_FILTER_FIELDS: readonly FilterFieldDef[] =
  [
    {
      key: "variants.price",
      label: "Price",
      scope: "variant",
      valueType: "number",
      operators: [
        "equals",
        "gt",
        "gte",
        "lt",
        "lte",
        "between",
      ],
    },
    {
      key: "variants.sku",
      label: "SKU",
      scope: "variant",
      valueType: "string",
      operators: ["equals", "contains"],
    },
    {
      key: "variants.inventoryQuantity",
      label: "Variant Inventory Quantity",
      scope: "variant",
      valueType: "number",
      operators: ["gt", "lt", "between"],
    },
    {
      key: "variants.trackQuantity",
      label: "Track Quantity",
      scope: "variant",
      valueType: "boolean",
      operators: ["equals"],
    },
  ] as const;
