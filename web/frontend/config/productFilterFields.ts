// web/frontend/src/config/productFilterFields.ts
import type { FilterFieldDef } from "./filterFields";

export const PRODUCT_FILTER_FIELDS: readonly FilterFieldDef[] =
  [
    {
      key: "title",
      label: "Title",
      scope: "product",
      valueType: "string",
      operators: [
        "contains",
        "equals",
        "starts_with",
      ],
    },
    {
      key: "vendor",
      label: "Vendor",
      scope: "product",
      valueType: "string",
      operators: ["equals", "contains"],
    },
    {
      key: "status",
      label: "Status",
      scope: "product",
      valueType: "select",
      operators: ["equals"],
      options: [
        { label: "Active", value: "ACTIVE" },
        { label: "Draft", value: "DRAFT" },
        {
          label: "Archived",
          value: "ARCHIVED",
        },
      ],
    },
    {
      key: "createdAt",
      label: "Date Created",
      scope: "product",
      valueType: "date",
      operators: [
        "before",
        "after",
        "between",
      ],
    },
    {
      key: "updatedAt",
      label: "Date Updated",
      scope: "product",
      valueType: "date",
      operators: [
        "before",
        "after",
        "between",
      ],
    },
    {
      key: "publishedAt",
      label: "Date Published",
      scope: "product",
      valueType: "date",
      operators: [
        "before",
        "after",
        "between",
      ],
    },
  ] as const;
