import { create } from "zustand";

/* ------------------------------------------------------------------ */
/* Types */
/* ------------------------------------------------------------------ */

interface SelectionState {
  selected: Set<string>;
  count: number;

  toggle: (id: string) => void;
  selectMany: (ids: string[]) => void;
  clear: () => void;
  isSelected: (id: string) => boolean;
}

/* ------------------------------------------------------------------ */
/* Store */
/* ------------------------------------------------------------------ */

export const useSelectionStore = create<SelectionState>(
  (set, get) => ({
    selected: new Set(),
    count: 0,

    toggle: (id) =>
      set((s) => {
        const next = new Set(s.selected);

        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }

        return { selected: next, count: next.size };
      }),

    selectMany: (ids) =>
      set((s) => {
        const next = new Set(s.selected);
        ids.forEach((id) => next.add(id));
        return { selected: next, count: next.size };
      }),

    clear: () =>
      set(() => ({
        selected: new Set(),
        count: 0,
      })),

    isSelected: (id) => {
      return get().selected.has(id);
    },
  })
);
