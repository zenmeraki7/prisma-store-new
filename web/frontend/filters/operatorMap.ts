// filters/operatorMap.ts

export const UI_TO_DSL_OPERATOR_MAP: Record<string, string> = {
  /* ---------------- TEXT ---------------- */

  equals: "is",
  does_not_equal: "is_not",

  contains: "contains",
  does_not_contain: "not_contains",

  starts_with: "starts_with",
  does_not_start_with: "not_starts_with",

  ends_with: "ends_with",

  is_blank: "is_blank",
  is_not_blank: "is_not_blank",

  equals_ci: "equals_ci",
  contains_ci: "contains_ci",


  /* ---------------- NUMBER (TEXT FALLBACKS) ---------------- */

  eq: "eq",
  neq: "neq",
  gt: "gt",
  gte: "gte",
  lt: "lt",
  lte: "lte",

  /* ---------------- RANGE ---------------- */

  between: "between",

  /* ---------------- DATE ---------------- */

  is_after: "is_after",
  is_before: "is_before",

  is_after_days: "is_after_days",
  is_before_days: "is_before_days",

  /* ---------------- ENUM ---------------- */

  is: "is",
  is_not: "is_not",

  /* ---------------- METAFIELD ---------------- */

  exists: "exists",
  not_exists: "not_exists",
};
