// web/frontend/config/filterFields.ts

/* ------------------------------------------------------------------ */
/* Types */
/* ------------------------------------------------------------------ */

export type FieldValueType =
  | "string"
  | "number"
  | "date"
  | "boolean"
  | "select";

export type FilterOperator =
  | "eq"
  | "neq"
  | "contains"
  | "starts_with"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "before"
  | "after"
  | "between"
  | "in";

export interface SelectOption {
  label: string;
  value: string;
}

export interface FilterFieldDef {
  label: string;

  /**
   * Canonical field identifier.
   * Backend resolves this into:
   * - Shopify search
   * - DB query
   * - Bulk API path
   */
  fieldKey: string;

  /**
   * Data category (drives UI + validation)
   */
  type: FieldValueType;

  /**
   * Allowed operators for this field
   */
  operators: FilterOperator[];

  /**
   * Select field options (if applicable)
   */
  options?: SelectOption[];

  /**
   * Advanced hints for backend resolution
   */
  meta?: {
    scope?: "product" | "variant" | "inventory";
    requiresLocation?: boolean;
    isAggregate?: boolean;
  };
}

/* ------------------------------------------------------------------ */
/* Field Definitions */
/* ------------------------------------------------------------------ */

export const FILTER_FIELDS: Record<string, FilterFieldDef[]> = {
  product: [
    {
      label: "Title",
      fieldKey: "product.title",
      type: "string",
      operators: ["contains", "eq", "starts_with"],
    },
    {
      label: "Vendor",
      fieldKey: "product.vendor",
      type: "string",
      operators: ["contains", "eq"],
    },
    {
      label: "Product Type",
      fieldKey: "product.type",
      type: "string",
      operators: ["contains", "eq"],
    },
    {
      label: "Status",
      fieldKey: "product.status",
      type: "select",
      operators: ["eq", "neq"],
      options: [
        { label: "Active", value: "ACTIVE" },
        { label: "Draft", value: "DRAFT" },
        { label: "Archived", value: "ARCHIVED" },
      ],
    },
    {
      label: "Tags",
      fieldKey: "product.tags",
      type: "string",
      operators: ["contains"],
    },
    {
      label: "Created Date",
      fieldKey: "product.created_at",
      type: "date",
      operators: ["after", "before", "between"],
    },
  ],

  variant: [
    {
      label: "SKU",
      fieldKey: "variant.sku",
      type: "string",
      operators: ["contains", "eq"],
      meta: { scope: "variant" },
    },
    {
      label: "Price",
      fieldKey: "variant.price",
      type: "number",
      operators: ["eq", "gt", "lt", "between"],
      meta: { scope: "variant" },
    },
    {
      label: "Compare At Price",
      fieldKey: "variant.compare_at_price",
      type: "number",
      operators: ["eq", "gt", "lt", "between"],
      meta: { scope: "variant" },
    },
    {
      label: "Barcode",
      fieldKey: "variant.barcode",
      type: "string",
      operators: ["contains", "eq"],
      meta: { scope: "variant" },
    },
    {
      label: "Weight",
      fieldKey: "variant.weight",
      type: "number",
      operators: ["eq", "gt", "lt"],
      meta: { scope: "variant" },
    },
  ],

  inventory_by_location: [
    {
      label: "Total Inventory",
      fieldKey: "inventory.total",
      type: "number",
      operators: ["eq", "gt", "lt"],
      meta: {
        scope: "inventory",
        isAggregate: true,
      },
    },
    {
      label: "Inventory at Location",
      fieldKey: "inventory.by_location",
      type: "number",
      operators: ["eq", "gt", "lt"],
      meta: {
        scope: "inventory",
        requiresLocation: true,
      },
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Helpers */
/* ------------------------------------------------------------------ */

export function getDefaultOperator(
  field: FilterFieldDef
): FilterOperator {
  return field.operators[0];
}

export function getDefaultValue(
  type: FieldValueType
): string {
  switch (type) {
    case "boolean":
      return "true";
    case "number":
      return "0";
    default:
      return "";
  }
}
