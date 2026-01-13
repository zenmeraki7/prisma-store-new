import type { FilterOperator } from "../config/filterFields";

export type FilterValue =
  | string
  | number
  | boolean
  | [number, number]
  | [string, string]
  | null;

/**
 * UI-level rule (schema-driven, serializable)
 */
export interface FilterRule {
  id: string;
  field: string;          // FilterFieldDef.key
  subField?: string;      // optional
  subValue?: string;      // optional
  operator: FilterOperator;
  value: FilterValue;
}
