import { create } from "zustand";

export const useProductStore = create((set) => ({
  filtered: [],
  setFiltered: (products) => set({ filtered: products }),
}));
