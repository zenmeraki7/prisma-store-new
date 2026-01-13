// web/frontend/src/filters/types.ts

/* ------------------------------------------------------------------ */
/* Canonical operators                                                 */
/* ------------------------------------------------------------------ */

export type CanonicalOperator =
  | "eq"
  | "neq"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "exists"
  | "not_exists"
  | "is_after"
  | "is_before"
  | "relative_after"
  | "relative_before";

/* ------------------------------------------------------------------ */
/* Canonical DSL nodes                                                 */
/* ------------------------------------------------------------------ */

export type ConditionNode = {
  condition: {
    field: string;
    op: CanonicalOperator;
    value?: any;
  };
};

export type FilterGroupNode =
  | { and: FilterNode[] }
  | { or: FilterNode[] };

export type FilterNode = ConditionNode | FilterGroupNode;

/* ------------------------------------------------------------------ */
/* Root DSL                                                            */
/* ------------------------------------------------------------------ */

export type FilterDSL = {
  and: FilterNode[];
};
