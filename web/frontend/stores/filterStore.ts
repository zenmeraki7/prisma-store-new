import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

/* ------------------------------------------------------------------ */
/* Types */
/* ------------------------------------------------------------------ */

export type FilterOperator =
  | "eq"
  | "neq"
  | "contains"
  | "not_contains"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "starts_with"
  | "ends_with";

export interface FilterRule {
  id: string;
  scope: "product" | "variant" | "inventory" | "metafield";
  fieldPath: string;
  fieldLabel: string;
  valueType: "string" | "number" | "date" | "boolean" | "select";
  operator: FilterOperator;
  value: string;
  metafieldNamespace?: string;
  metafieldKey?: string;
}

export interface FilterGroup {
  id: string;
  operator: "AND" | "OR";
  rules: FilterRule[];
}

interface FilterState {
  groups: FilterGroup[];

  /* UI */
  fieldPickerOpen: boolean;
  fieldPickerRule:
    | { groupIndex: number; ruleIndex: number }
    | null;

  /* Actions */
  addGroup: () => void;
  removeGroup: (index: number) => void;
  addRule: (groupIndex: number) => void;
  removeRule: (groupIndex: number, ruleIndex: number) => void;
  updateRule: (
    groupIndex: number,
    ruleIndex: number,
    data: Partial<FilterRule>
  ) => void;
  openFieldPicker: (groupIndex: number, ruleIndex: number) => void;
  closeFieldPicker: () => void;
  reset: () => void;
}

/* ------------------------------------------------------------------ */
/* Store */
/* ------------------------------------------------------------------ */

export const useFilterStore = create(
  immer<FilterState>((set) => ({
    groups: [{ id: "g_0", operator: "AND", rules: [] }],
    fieldPickerOpen: false,
    fieldPickerRule: null,

    /* ---------------- GROUPS ---------------- */

    addGroup: () =>
      set((s) => {
        s.groups.push({
          id: `g_${Date.now()}`,
          operator: "AND",
          rules: [],
        });
      }),

    removeGroup: (index) =>
      set((s) => {
        s.groups.splice(index, 1);
      }),

    /* ---------------- RULES ---------------- */

    addRule: (groupIndex) =>
      set((s) => {
        s.groups[groupIndex].rules.push({
          id: `r_${Date.now()}`,
          scope: "product",
          fieldPath: "",
          fieldLabel: "Select field…",
          valueType: "string",
          operator: "eq",
          value: "",
        });
      }),

    removeRule: (groupIndex, ruleIndex) =>
      set((s) => {
        s.groups[groupIndex].rules.splice(ruleIndex, 1);
      }),

    updateRule: (groupIndex, ruleIndex, data) =>
      set((s) => {
        Object.assign(
          s.groups[groupIndex].rules[ruleIndex],
          data
        );
      }),

    /* ---------------- UI ---------------- */

    openFieldPicker: (groupIndex, ruleIndex) =>
      set((s) => {
        s.fieldPickerOpen = true;
        s.fieldPickerRule = { groupIndex, ruleIndex };
      }),

    closeFieldPicker: () =>
      set((s) => {
        s.fieldPickerOpen = false;
        s.fieldPickerRule = null;
      }),

    /* ---------------- RESET ---------------- */

    reset: () =>
      set((s) => {
        s.groups = [{ id: "g_0", operator: "AND", rules: [] }];
      }),
  }))
);

/* ------------------------------------------------------------------ */
/* Selectors */
/* ------------------------------------------------------------------ */

export const useFilterGroups = () =>
  useFilterStore((s) => s.groups);

export const useFieldPickerState = () =>
  useFilterStore((s) => ({
    open: s.fieldPickerOpen,
    rule: s.fieldPickerRule,
  }));
