// web/services/filters/compiler.fast.ts
//
// FAST compiler: PlanLeaf[] -> parameterized SQL fragments (joins + WHERE).
//
// No-drift contract:
// - All key/op/value validation must be enforced by registry.validate.ts.
// - This compiler only:
//   (a) chooses table aliases,
//   (b) emits parameterized SQL,
//   (c) applies *SQL* casts needed for Postgres types (bigint, numeric, etc).
//
// DB naming: snake_case
// Aliases:
//   product_lite     pl
//   variant_rollups  vr
//
// Notes on types:
// - product_lite.product_id is BIGINT
// - product_collection.collection_id is BIGINT
// - variant_rollups.* numeric/integer/boolean as per migrations
//
// ESM TypeScript.

import type { PlanLeaf } from "./planner";
import {
  getFilterSpec,
  assertOperatorAllowed,
  assertArity,
  coerceAndValidateValue,
  type Operator,
  type FilterSpec,
} from "./registry.validate";

export type CompiledFast = {
  joinsSql: string[];
  whereSql: string; // without "WHERE"
  params: any[];
};

export function compileFastWhere(leaves: PlanLeaf[]): CompiledFast {
  const params: any[] = [];
  const whereParts: string[] = [];
  let needsRollups = false;

  for (const leaf of leaves) {
    const spec = getFilterSpec(leaf.key);

    if (spec.tier !== "FAST") {
      throw new Error(`FAST compiler: received non-FAST leaf key=${leaf.key} tier=${spec.tier}`);
    }

    // Enforce operator + arity at the boundary (no drift)
    assertOperatorAllowed(spec.key, leaf.op);
    const op = leaf.op as Operator;
    assertArity(op, leaf.value);

    // Registry guarantees FAST has source
    const source = spec.source!;
    const table = source.table;
    const col = source.column;

    if (source.kind === "column") {
      if (table === "product_lite") {
        whereParts.push(generateColumnClause({ spec, colExpr: `pl.${col}`, op, rawValue: leaf.value, params }));
        continue;
      }

      if (table === "variant_rollups") {
        needsRollups = true;
        whereParts.push(generateColumnClause({ spec, colExpr: `vr.${col}`, op, rawValue: leaf.value, params }));
        continue;
      }

      throw new Error(`FAST compiler: unsupported column table=${table} key=${leaf.key}`);
    }

    if (source.kind === "join") {
      // Join filters must be in|nin per your registry usage
      if (op !== "in" && op !== "nin") {
        throw new Error(`FAST compiler: join filter must be in|nin key=${leaf.key} op=${op}`);
      }

      const values = normalizeArrayValue(leaf.value);

      // Empty semantics:
      // - in []  => FALSE
      // - nin [] => TRUE
      if (values.length === 0) {
        whereParts.push(op === "in" ? "FALSE" : "TRUE");
        continue;
      }

      const { coercedArray, anyCast } = coerceJoinArray(spec, values);

      const existsOp = op === "nin" ? "NOT EXISTS" : "EXISTS";
      const p = pushParam(params, coercedArray);

      // Enforce joinNegationPolicy: use NOT EXISTS (never LEFT JOIN ... IS NULL)
      whereParts.push(
        `${existsOp} (
          SELECT 1
          FROM ${table} jt
          WHERE jt.product_id = pl.product_id
            AND jt.shop_id = pl.shop_id
            AND jt.${col} = ANY(${p}${anyCast})
        )`
      );
      continue;
    }

    throw new Error(`FAST compiler: unknown source.kind for key=${leaf.key}`);
  }

  const joinsSql: string[] = [];
  if (needsRollups) {
    joinsSql.push(`INNER JOIN variant_rollups vr ON vr.product_id = pl.product_id AND vr.shop_id = pl.shop_id`);
  }

  const whereSql = whereParts.length ? whereParts.map((w) => `(${w})`).join(" AND ") : "TRUE";
  return { joinsSql, whereSql, params };
}

// -----------------------------
// Helpers
// -----------------------------

function pushParam(params: any[], v: any): string {
  params.push(v);
  return `$${params.length}`;
}

function normalizeArrayValue(v: any): any[] {
  if (v === null || v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function requireBetweenTuple(v: any, ctx: { key: string }): [any, any] {
  if (!Array.isArray(v) || v.length !== 2) {
    const got =
      v === null
        ? "null"
        : v === undefined
          ? "undefined"
          : Array.isArray(v)
            ? `array(len=${v.length})`
            : typeof v;
    throw new Error(`FAST compiler: between expects [a,b] for key=${ctx.key}, got ${got}`);
  }
  return [v[0], v[1]];
}

/**
 * Minimal SQL casting policy:
 * - bigint columns: cast RHS params to ::bigint / ::bigint[]
 * - money columns: cast RHS params to ::numeric / ::numeric[]
 *
 * Everything else: rely on parameter typing + schema.
 */
function sqlScalarCastFor(spec: FilterSpec): "" | "::bigint" | "::numeric" {
  // BIGINT-backed FAST keys in your schema
  if (spec.key === "product.productId") return "::bigint";
  // If later you add more bigint scalars, extend here deterministically.

  // Money => numeric
  if (spec.valueType === "money") return "::numeric";

  return "";
}

function sqlArrayCastFor(spec: FilterSpec): "" | "::bigint[]" | "::numeric[]" {
  if (spec.key === "product.productId") return "::bigint[]";
  if (spec.valueType === "money") return "::numeric[]";
  return "";
}

/**
 * Coerce raw values using registry.validate.ts contracts.
 * This keeps coercion deterministic and aligned with JSON.
 */
function coerceScalar(spec: FilterSpec, raw: any): any {
  return coerceAndValidateValue(spec.valueType as any, raw, { key: spec.key });
}

function coerceArray(spec: FilterSpec, raws: any[]): any[] {
  return raws.map((v) => coerceScalar(spec, v));
}

function generateColumnClause(input: {
  spec: FilterSpec;
  colExpr: string;
  op: Operator;
  rawValue: any;
  params: any[];
}): string {
  const { spec, colExpr, op, rawValue, params } = input;

  const scalarCast = sqlScalarCastFor(spec);
  const arrayCast = sqlArrayCastFor(spec);

  switch (op) {
    case "eq": {
      const v = coerceScalar(spec, rawValue);
      const p = pushParam(params, v);
      return `${colExpr} = ${p}${scalarCast}`;
    }

    case "neq": {
      const v = coerceScalar(spec, rawValue);
      const p = pushParam(params, v);
      return `${colExpr} <> ${p}${scalarCast}`;
    }

    case "in": {
      const xs = coerceArray(spec, normalizeArrayValue(rawValue));
      if (xs.length === 0) return "FALSE";
      const p = pushParam(params, xs);
      return `${colExpr} = ANY(${p}${arrayCast || ""})`;
    }

    case "nin": {
      const xs = coerceArray(spec, normalizeArrayValue(rawValue));
      if (xs.length === 0) return "TRUE";
      const p = pushParam(params, xs);
      return `NOT (${colExpr} = ANY(${p}${arrayCast || ""}))`;
    }

    case "gte": {
      const v = coerceScalar(spec, rawValue);
      const p = pushParam(params, v);
      return `${colExpr} >= ${p}${scalarCast}`;
    }

    case "lte": {
      const v = coerceScalar(spec, rawValue);
      const p = pushParam(params, v);
      return `${colExpr} <= ${p}${scalarCast}`;
    }

    case "gt": {
      const v = coerceScalar(spec, rawValue);
      const p = pushParam(params, v);
      return `${colExpr} > ${p}${scalarCast}`;
    }

    case "lt": {
      const v = coerceScalar(spec, rawValue);
      const p = pushParam(params, v);
      return `${colExpr} < ${p}${scalarCast}`;
    }

    case "between": {
      const [aRaw, bRaw] = requireBetweenTuple(rawValue, { key: spec.key });
      const a = coerceScalar(spec, aRaw);
      const b = coerceScalar(spec, bRaw);
      const p1 = pushParam(params, a);
      const p2 = pushParam(params, b);

      // BETWEEN must cast both bounds if needed
      if (scalarCast === "::bigint") return `${colExpr} BETWEEN ${p1}::bigint AND ${p2}::bigint`;
      if (scalarCast === "::numeric") return `${colExpr} BETWEEN ${p1}::numeric AND ${p2}::numeric`;

      return `${colExpr} BETWEEN ${p1} AND ${p2}`;
    }

    case "is": {
      // boolean "is"
      const v = coerceScalar(spec, rawValue);
      const p = pushParam(params, Boolean(v));
      return `${colExpr} = ${p}`;
    }

    case "isnull":
      return `${colExpr} IS NULL`;

    case "notnull":
      return `${colExpr} IS NOT NULL`;

    default:
      throw new Error(`FAST compiler: unsupported operator op=${op} key=${spec.key}`);
  }
}

/**
 * Join coercion + typed ANY casts.
 * - product.collectionId uses BIGINT join column collection_id
 * - product.tag uses TEXT join column tag
 */
function coerceJoinArray(
  spec: FilterSpec,
  values: any[]
): { coercedArray: any[]; anyCast: "" | "::bigint[]" } {
  if (spec.key === "product.collectionId") {
    // Registry valueType currently: "string" (decimal string).
    // If you switch registry to "gid", registry.validate.ts can parse gid,
    // and this code remains unchanged.
    const xs = values.map((v) => coerceAndValidateValue("string" as any, v, { key: spec.key }));
    // But enforce decimal shape for bigint joins here (SQL type safety).
    const coerced = xs.map((s) => {
      const str = String(s).trim();
      if (!/^\d+$/.test(str)) {
        throw new Error(`FAST compiler: collectionId must be decimal string for key=${spec.key}`);
      }
      return str;
    });
    return { coercedArray: coerced, anyCast: "::bigint[]" };
  }

  if (spec.key === "product.tag") {
    const coerced = values.map((v) => coerceAndValidateValue("string" as any, v, { key: spec.key }));
    return { coercedArray: coerced, anyCast: "" };
  }

  // If you add more join keys later, they must be explicitly mapped here (no drift).
  throw new Error(`FAST compiler: unknown join key=${spec.key}`);
}
