import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { ProductLite } from "../types/product";

/* ------------------------------------------------------------------ */
/* Types */
/* ------------------------------------------------------------------ */

interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

interface ProductState {
  byId: Record<string, ProductLite>;
  order: string[];
  pageInfo: PageInfo;
  isLoading: boolean;
  isFetchingNext: boolean;

  /* Actions */
  upsertMany: (products: ProductLite[], reset?: boolean) => void;
  updateField: (
    id: string,
    field: keyof ProductLite,
    value: any
  ) => void;
  setPageInfo: (info: PageInfo) => void;
  setLoading: (val: boolean) => void;
  setFetchingNext: (val: boolean) => void;
  reset: () => void;
}

/* ------------------------------------------------------------------ */
/* Store */
/* ------------------------------------------------------------------ */

export const useProductStore = create(
  immer<ProductState>((set) => ({
    byId: {},
    order: [],
    pageInfo: { hasNextPage: false, endCursor: null },
    isLoading: false,
    isFetchingNext: false,

    /* ---------------- UPSERT ---------------- */

    upsertMany: (products, reset = false) =>
      set((state) => {
        if (reset) {
          state.byId = {};
          state.order = [];
        }

        for (const p of products) {
          if (!state.byId[p.id]) {
            state.order.push(p.id);
          }
          state.byId[p.id] = p;
        }
      }),

    /* ---------------- Stack UPDATE ---------------- */

    updateField: (id, field, value) =>
      set((state) => {
        if (!state.byId[id]) return;
        (state.byId[id] as any)[field] = value;
      }),

    /* ---------------- PAGINATION ---------------- */

    setPageInfo: (info) =>
      set((state) => {
        state.pageInfo = info;
      }),

    setLoading: (val) =>
      set((state) => {
        state.isLoading = val;
      }),

    setFetchingNext: (val) =>
      set((state) => {
        state.isFetchingNext = val;
      }),

    /* ---------------- RESET ---------------- */

    reset: () =>
      set((state) => {
        state.byId = {};
        state.order = [];
        state.pageInfo = { hasNextPage: false, endCursor: null };
        state.isLoading = false;
        state.isFetchingNext = false;
      }),
  }))
);

/* ------------------------------------------------------------------ */
/* Selectors (IMPORTANT for performance) */
/* ------------------------------------------------------------------ */

export const useProductIds = () =>
  useProductStore((s) => s.order);

export const useProductById = (id: string) =>
  useProductStore((s) => s.byId[id]);

export const useProductPagination = () =>
  useProductStore((s) => s.pageInfo);
