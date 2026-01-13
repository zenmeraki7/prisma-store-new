// filters/useFilterState.ts
import { useMemo, useState } from "react";
import { FilterDSL } from "./types";
import { DEFAULT_FILTER_DSL } from "./default";
import { UI_TO_DSL_OPERATOR_MAP } from "./operatorMap";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */


function countNodes(dsl: FilterDSL): number {
  if ("and" in dsl) {
    return dsl.and.reduce(
      (sum, n) =>
        sum +
        ("condition" in n ? 1 : countNodes(n)),
      0
    );
  }
  if ("or" in dsl) {
    return dsl.or.reduce(
      (sum, n) =>
        sum +
        ("condition" in n ? 1 : countNodes(n)),
      0
    );
  }
  return 0;
}

function sanitizeDsl(node: any): any | null {
  if (!node) return null;

  // GROUP
  if ("and" in node || "or" in node) {
    const key = "and" in node ? "and" : "or";

    const children = node[key]
      .map(sanitizeDsl)
      .filter(Boolean);

    // 🚨 Drop empty groups
    if (children.length === 0) return null;

    return { [key]: children };
  }

 
// CONDITION
if ("condition" in node) {
  const { field, op, value } = node.condition;

  // 🚨 Drop empty conditions
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const mappedOp =
    UI_TO_DSL_OPERATOR_MAP[op ?? "equals"] ?? "is";

  return {
    condition: {
      field,
      op: mappedOp,
      value,
    },
  };
}

}
/* ------------------------------------------------------------------ */
/* Hook                                                               */
/* ------------------------------------------------------------------ */

export function useFilterState() {
  const [draft, setDraft] = useState<FilterDSL>(DEFAULT_FILTER_DSL);
  const [applied, setApplied] = useState<FilterDSL>(DEFAULT_FILTER_DSL);

const sanitizedDsl = useMemo(
  () => sanitizeDsl(applied) ?? undefined,
  [applied]
);


  /* ---------------- derived ---------------- */

const appliedCount = useMemo(
  () => (sanitizedDsl ? countNodes(sanitizedDsl) : 0),
  [sanitizedDsl]
);

  const hasFilters = appliedCount > 0;

  /* ---------------- actions ---------------- */

  const applyDraft = () => {
    setApplied(draft);
  };

  const clearAll = () => {
    setDraft(DEFAULT_FILTER_DSL);
    setApplied(DEFAULT_FILTER_DSL);
  };

  /* ---------------- exposed ---------------- */

  return {
    // state
    draft,
    applied,

    // setters
    setDraft,

    // actions
    applyDraft,
    clearAll,

    // derived
    appliedCount,
    hasFilters,

    // canonical name used by Products.tsx
     dsl: sanitizedDsl,

  };
}
