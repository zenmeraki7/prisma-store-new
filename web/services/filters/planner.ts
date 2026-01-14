// web/services/filters/planner.ts
//
// Planner: validates incoming DSL leaves against registry (no drift) and splits into:
// - FAST leaves (index-safe, Postgres)
// - SNAPSHOT leaves (Shopify search / BulkOp + local eval)
//
// Guarantees:
// - Every leaf is validated via registry.assertLeafAllowed()
// - Canonical semantics are sourced from registry (no drift)
// - Deterministic plan hashing (planHash) + registryHash passthrough
// - Current behavior is FLAT: treats DSL as conjunction (AND) across all leaves.
//   (If you later preserve boolean groups, introduce planner.nested.ts.)
//
// ESM TypeScript.

import crypto from "node:crypto";
import {
  assertLeafAllowed,
  getFilterDef,
  isFastKey,
  isSnapshotKey,
  registryHash,
  type FilterDef,
  type Operator,
} from "./registry";

export type LogicOp = "AND" | "OR" | "NOT";

// Frontend DSL (canonical)
export type FilterNode =
  | {
      op: LogicOp;
      conditions: FilterNode[];
    }
  | {
      key: string;
      op: Operator;
      value?: any;
      // Optional metadata passthrough. Not used in planning/hashing to avoid drift.
      semantics?: any;
    };

// Output leaf used by compiler/evaluators
export type PlanLeaf = {
  key: string;
  op: Operator;
  value?: any;

  // Canonical semantics from registry (materialized defaults)
  semantics: FilterDef["semantics"];
};

export type PlannedFilters = {
  fast: PlanLeaf[];
  snapshot: PlanLeaf[];
  meta: {
    registryHash: string;
    planHash: string;
  };
};

// -----------------------------
// Deterministic hashing helpers
// -----------------------------

function stableStringify(v: any): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const keys = Object.keys(v).sort();
  return `{${keys
    .map((k) => {
      const sv = stableStringify(v[k]);
      return `${JSON.stringify(k)}:${sv === undefined ? "null" : sv}`;
    })
    .join(",")}}`;
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function normalizeKey(input: any): string {
  const k = String(input ?? "").trim();
  if (!k) throw new Error("planner: missing leaf.key");
  return k;
}

function normalizeOp(input: any): Operator {
  const op = String(input ?? "").trim();
  if (!op) throw new Error("planner: missing leaf.op");
  return op as Operator;
}

// -----------------------------
// Flattening (current behavior)
// -----------------------------

function flattenLeaves(node: any, out: Array<{ key: string; op: Operator; value?: any }>) {
  if (!node) return;

  // group
  if (typeof node === "object" && "op" in node && "conditions" in node && Array.isArray((node as any).conditions)) {
    const op = String((node as any).op ?? "").toUpperCase();

    // Current planner is FLAT and treats everything as AND-conjunction.
    // We still traverse children deterministically.
    if (op === "AND" || op === "OR" || op === "NOT") {
      for (const child of (node as any).conditions) flattenLeaves(child, out);
      return;
    }
  }

  // leaf
  const key = normalizeKey((node as any).key ?? (node as any).field); // allow legacy {field}
  const op = normalizeOp((node as any).op);
  const value = (node as any).value;

  out.push({ key, op, value });
}

// -----------------------------
// Public planner
// -----------------------------

export function planFilters(root: FilterNode): PlannedFilters {
  const flat: Array<{ key: string; op: Operator; value?: any }> = [];
  flattenLeaves(root, flat);

  const fast: PlanLeaf[] = [];
  const snapshot: PlanLeaf[] = [];

  for (const leaf of flat) {
    // Fail-fast validation: key exists, operator allowed, arity satisfied, metafield contract enforced.
    assertLeafAllowed({ key: leaf.key, op: leaf.op, value: leaf.value });

    // Pull canonical definition (includes semantics defaults materialized by registry loader).
    const def = getFilterDef(leaf.key);

    const planned: PlanLeaf = {
      key: leaf.key,
      op: leaf.op,
      value: leaf.value,
      semantics: def.semantics,
    };

    // Tier split
    if (isFastKey(leaf.key)) fast.push(planned);
    else if (isSnapshotKey(leaf.key)) snapshot.push(planned);
    else {
      // Defensive: should never happen because registry enforces tier ∈ FAST|SNAPSHOT.
      throw new Error(`planner: unknown tier for key=${leaf.key}`);
    }
  }

  // Deterministic plan hash:
  // - include registryHash (ties snapshots to registry revision)
  // - include only normalized leaves (no UI-only metadata)
  const rh = registryHash();
  const planHash = sha256Hex(
    stableStringify({
      v: 1,
      registryHash: rh,
      fast: fast.map((l) => ({ key: l.key, op: l.op, value: l.value })),
      snapshot: snapshot.map((l) => ({ key: l.key, op: l.op, value: l.value })),
    })
  );

  return {
    fast,
    snapshot,
    meta: { registryHash: rh, planHash },
  };
}
