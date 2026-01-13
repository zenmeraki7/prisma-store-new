import { create } from "zustand";
import type { SelectionContext } from "./selectionContext";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export type SelectionMode = "none" | "page" | "all";

interface SelectionState {
  mode: SelectionMode;

  /**
   * Only used when mode === "page"
   */
  selectedIds: Set<string>;

  /**
   * REQUIRED when mode === "all"
   * Immutable snapshot of intent
   */
  context: SelectionContext | null;

  /* ---------------- Actions ---------------- */

  selectOne: (id: string) => void;
  deselectOne: (id: string) => void;
  selectPage: (ids: string[]) => void;

  /**
   * Symbolic selection of entire result set
   */
  selectAllResults: (context: SelectionContext) => void;

  clear: () => void;
}

/* ------------------------------------------------------------------ */
/* Store                                                              */
/* ------------------------------------------------------------------ */

export const useSelectionStore = create<SelectionState>(
  (set, get) => ({
    mode: "none",
    selectedIds: new Set(),
    context: null,

    /* ---------------- Page selection ---------------- */

    selectOne: (id: string) =>
      set(state => {
        const next = new Set(state.selectedIds);
        next.add(id);

        return {
          mode: "page",
          selectedIds: next,
          context: null,
        };
      }),

    deselectOne: (id: string) =>
      set(state => {
        const next = new Set(state.selectedIds);
        next.delete(id);

        return {
          mode: next.size > 0 ? "page" : "none",
          selectedIds: next,
          context: null,
        };
      }),

    selectPage: (ids: string[]) =>
      set({
        mode: "page",
        selectedIds: new Set(ids),
        context: null,
      }),

    /* ---------------- ALL selection ---------------- */

    /**
     * mode = "all" is SYMBOLIC.
     * Backend execution MUST use context.
     */
    selectAllResults: (context: SelectionContext) =>
      set({
        mode: "all",
        selectedIds: new Set(), // invariant
        context,
      }),

    /* ---------------- Reset ---------------- */

    clear: () =>
      set({
        mode: "none",
        selectedIds: new Set(),
        context: null,
      }),
  })
);
