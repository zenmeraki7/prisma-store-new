import { create } from "zustand";

export const useFilterStore = create((set) => ({
  rules: [],
  query: { AND: [] },
  results: [],

  addRule: () =>
    set((s) => ({
      rules: [...s.rules, { field: "vendor", operator: "eq", value: "" }],
    })),

  updateRule: (index, updated) =>
    set((s) => {
      const rules = [...s.rules];
      rules[index] = updated;
      return { rules, query: { AND: rules } };
    }),

  setResults: (results) => set({ results }),
}));
