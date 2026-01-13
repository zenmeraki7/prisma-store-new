// filters/registry.ts

export type FilterFieldType =
  | "text"
  | "number"
  | "date"
  | "enum"
  | "multi_enum"
  | "range"
  | "metafield";

  const TEXT_OPERATORS = [
  "equals",
  "does_not_equal",

  "contains",
  "does_not_contain",

  "contains_any_words",

  "starts_with",
  "does_not_start_with",

  "ends_with",

  "is_blank",
  "is_not_blank",

  "equals_ci",
  "contains_ci",
] as const;

export const FILTER_REGISTRY = {
  /* ---------------- TEXT ---------------- */

  "product.title": {
    label: "Title",
    type: "text",
    operators: TEXT_OPERATORS,
  },

  "product.handle": {
    label: "Handle",
    type: "text",
    operators: TEXT_OPERATORS,
  },

  "product.description": {
    label: "Description",
    type: "text",
    operators: TEXT_OPERATORS,
  },

  "product.vendor": {
    label: "Vendor",
    type: "text",
    operators: TEXT_OPERATORS,
  },

  "product.productType": {
    label: "Product type",
    type: "text",
    operators: TEXT_OPERATORS,
  },

  "variant.sku": {
    label: "SKU",
    type: "text",
    operators: TEXT_OPERATORS,
  },

  "variant.barcode": {
    label: "Barcode",
    type: "text",
    operators: TEXT_OPERATORS,
  },

  /* ---------------- ENUM ---------------- */

  "product.status": {
    label: "Status",
    type: "enum",
     picker: "status",
    operators: ["is", "is_not"],
  },

  "product.collectionId": {
    label: "Collection",
    type: "enum",
     picker: "collection",
    operators: ["is", "is_not"],
     defaultOperator: "is",
     defaultValue: "",
  },

  "product.tags": {
    label: "Tags",
    type: "multi_enum",
    operators: ["contains_any", "contains_all"],
  },

  /* ---------------- NUMBER ---------------- */

 "variant.price": {
  label: "Price",
  type: "number",
  operators: ["eq", "neq", "gt", "lt"],
  operatorLabels: {
    eq: "=",
     neq: "≠",
    gt: ">",
    lt: "<",
   
  },
},

  "variant.compareAtPrice": {
    label: "Compare at price",
    type: "number",
    operators: ["eq", "gt", "lt"],
  },

  /* ---------------- RANGE ---------------- */

  "product.totalInventory": {
    label: "Inventory",
    type: "range",
    operators: ["between", "gt", "lt"],
  },

  /* ---------------- DATE ---------------- */

  "product.createdAt": {
    label: "Created date",
    type: "date",
    operators: [
      "is_after",
      "is_before",
      "is_after_days",
      "is_before_days",
    ],
  },

  "product.updatedAt": {
    label: "Updated date",
    type: "date",
    operators: [
      "is_after",
      "is_before",
      "is_after_days",
      "is_before_days",
    ],
  },

  "product.publishedAt": {
    label: "Published date",
    type: "date",
    operators: [
      "is_after",
      "is_before",
      "is_after_days",
      "is_before_days",
    ],
  },

  /* ---------------- METAFIELD ---------------- */

  "metafield": {
    label: "Metafield",
    type: "metafield",
    operators: [
      "eq",
      "contains",
      "gt",
      "lt",
      "exists",
      "not_exists",
    ],
  },
} as const;

