// web/services/filters/registry.ts
//
// Authoritative registry loader + validator + helpers (no-drift).
// Supports filterRegistry.v1 revision >= 1.2 (dbNaming, operatorArity, valueTypeContracts,
// sources, joinSpecs, joinNegationPolicy, snapshotCompile, deterministic filters[] contract).
//
// Guarantees (hard errors):
// - Duplicate keys rejected
// - Operator arity enforced (0/1/2/"N")
// - Filter operator lists must be consistent with operatorArity
// - Enum filters must declare enumValues
// - FAST filters: source.kind must be column|join and must reference declared sources tables
// - FAST column sources: column must exist in sources[decl].requiredColumns
// - FAST join sources: join table must exist in sources and must have explicit joinSpec binding
// - JOIN filters must only allow in/nin and must use NOT_EXISTS negation
// - SNAPSHOT filters must declare deterministic snapshot compile:
//   * SHOPIFY_SEARCH requires queryTemplate (fallback allowed but not required)
//   * BULKOP requires bulkShape + postFilter; bulkShape must exist in snapshotCompile.bulkShapes
// - Every filter MUST declare semantics; for variant-derived filters, defaults are applied
//   from registry.defaults when quantifier/atomicity are omitted.
//
// Patch:
// - Tight metafield Zod schema (namespace,key,op,value; op ∈ eq|neq|in|nin; value is string)
// - Add optional onUnknownKey hook for telemetry (Sentry, etc.) without coupling.
// - Add requested gatekeeper helpers:
//   getFilterSpec(key)
//   assertOperatorAllowed(key, op)
//   assertArity(op, value)
//   coerceAndValidateValue(valueType, rawValue)
//   registryHash (function)
//
// Assumes file path: web/config/filterRegistry.v1.json

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";

export type Tier = "FAST" | "SNAPSHOT";
export type Operator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "nin"
  | "between"
  | "isnull"
  | "notnull"
  | "is";

export type ValueType = "gid" | "datetime" | "money" | "number" | "boolean" | "string" | "enum" | "metafield";

const OperatorSchema = z.enum([
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "nin",
  "between",
  "isnull",
  "notnull",
  "is",
]);

const TierSchema = z.enum(["FAST", "SNAPSHOT"]);

const DbNamingSchema = z.object({
  tables: z.enum(["snake_case", "camelCase"]).default("snake_case"),
  columns: z.enum(["snake_case", "camelCase"]).default("snake_case"),
});

const ValueTypeSchema = z.enum(["gid", "datetime", "money", "number", "boolean", "string", "enum", "metafield"]);

const OperatorAritySchema = z.record(OperatorSchema, z.union([z.literal(0), z.literal(1), z.literal(2), z.literal("N")]));

// Strict metafield contract: namespace, key, op, value(string). op limited to eq|neq|in|nin.
const MetafieldOpSchema = z.enum(["eq", "neq", "in", "nin"]);
const MetafieldContractSchema = z.object({
  namespace: z.string().min(1),
  key: z.string().min(1),
  op: MetafieldOpSchema,
  value: z.string(), // "no drift string value" rule
});

const ValueTypeContractsSchema = z.object({
  gid: z.object({ kind: z.literal("string"), pattern: z.string().min(1) }),
  datetime: z.object({ kind: z.literal("string"), format: z.literal("iso8601") }),
  money: z.object({ kind: z.literal("number"), notes: z.string().optional() }),
  number: z.object({ kind: z.literal("number") }),
  boolean: z.object({ kind: z.literal("boolean") }),
  string: z.object({ kind: z.literal("string") }),
  enum: z.object({ kind: z.literal("string") }),

  metafield: z.object({
    kind: z.literal("object"),
    required: z.tuple([z.literal("namespace"), z.literal("key"), z.literal("op"), z.literal("value")]),
    properties: z.object({
      namespace: z.object({ kind: z.literal("string") }),
      key: z.object({ kind: z.literal("string") }),
      op: z.object({ kind: z.literal("string"), enum: z.array(MetafieldOpSchema).min(1) }),
      value: z.object({ kind: z.literal("string") }),
    }),
    notes: z.string().optional(),
  }),
});

const SourceDeclSchema = z.object({
  table: z.string().min(1),
  requiredColumns: z.array(z.string().min(1)).min(1),
});

const JoinSpecSchema = z.object({
  leftTable: z.string().min(1),
  leftKey: z.string().min(1),
  rightTable: z.string().min(1),
  rightKey: z.string().min(1),
});

const JoinNegationPolicySchema = z.object({
  default: z.enum(["NOT_EXISTS"]).default("NOT_EXISTS"),
  notes: z.string().optional(),
});

const SnapshotCompileSchema = z.object({
  strategies: z.array(z.enum(["SHOPIFY_SEARCH", "BULKOP"])).min(1),
  bulkShapes: z.record(
    z.string().min(1),
    z.object({
      description: z.string().min(1),
      fields: z.array(z.string().min(1)).optional(),
      variantFields: z.array(z.string().min(1)).optional(),
      productMetafields: z.string().optional(),
    })
  ),
});

// NOTE: joinSpec is required only when kind === "join" (deterministic binding).
const FilterSourceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("column"),
    table: z.string().min(1),
    column: z.string().min(1),
  }),
  z.object({
    kind: z.literal("join"),
    table: z.string().min(1),
    column: z.string().min(1), // membership column in join table (e.g., tag, collection_id)
    joinSpec: z.string().min(1), // key into registry.joinSpecs
  }),
]);

const JoinSemanticsSchema = z.object({
  membership: z.enum(["ANY"]).default("ANY"),
  negation: z.enum(["NOT_EXISTS"]).default("NOT_EXISTS"),
});

const SnapshotPostFilterSchema = z.object({
  op: z.literal("LOCAL_EVAL"),
  path: z.string().min(1),
  match: z.string().min(1),
  caseSensitive: z.boolean().optional(),
  coerce: z.string().optional(),
  collapseToProductIds: z
    .object({
      derivedFrom: z.enum(["VARIANTS"]),
      quantifier: z.enum(["ANY", "ALL", "SAME_VARIANT"]).optional(),
    })
    .optional(),
});

const FilterSnapshotSchema = z.object({
  strategy: z.enum(["SHOPIFY_SEARCH", "BULKOP"]),
  queryTemplate: z.string().optional(),
  bulkShape: z.string().optional(),
  postFilter: SnapshotPostFilterSchema.optional(),

  fallback: z
    .object({
      strategy: z.enum(["SHOPIFY_SEARCH", "BULKOP"]),
      queryTemplate: z.string().optional(),
      bulkShape: z.string().optional(),
      postFilter: SnapshotPostFilterSchema.optional(),
    })
    .optional(),

  // keep as opaque metadata if needed; avoid z.any()
  metafieldShape: z.unknown().optional(),
  notes: z.string().optional(),
});

// semantics are REQUIRED on every filter, but quantifier/atomicity can be omitted and defaulted
// when derivedFrom === "VARIANTS".
const SemanticsSchema = z.object({
  scope: z.enum(["PRODUCT", "VARIANT"]),
  derivedFrom: z.enum(["NONE", "VARIANTS"]),
  quantifier: z.enum(["ANY", "ALL", "SAME_VARIANT"]).optional(),
  atomicity: z.enum(["PER_PRODUCT", "PER_VARIANT", "PER_PRODUCT_ROLLUP"]).optional(),
});

const FilterDefSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  tier: TierSchema,
  valueType: ValueTypeSchema,
  operators: z.array(OperatorSchema).min(1),

  enumValues: z.array(z.string().min(1)).optional(),
  notes: z.string().optional(),

  source: FilterSourceSchema.optional(),
  joinSemantics: JoinSemanticsSchema.optional(),
  indexesRequired: z.array(z.string().min(1)).optional(),

  snapshot: FilterSnapshotSchema.optional(),
  semantics: SemanticsSchema, // REQUIRED (no drift)
});

const RegistrySchema = z.object({
  version: z.literal("filterRegistry.v1"),
  revision: z.string().min(1).optional(),
  scope: z.string().min(1),
  dbNaming: DbNamingSchema.optional(),

  defaults: z.object({
    tenantKey: z.string().min(1),
    variantQuantifierDefault: z.enum(["ANY", "ALL", "SAME_VARIANT"]),
    variantAtomicityDefault: z.enum(["PER_VARIANT", "PER_PRODUCT", "PER_PRODUCT_ROLLUP"]),
    fastPlaneRule: z.string().min(1),
    snapshotPlaneRule: z.string().min(1),
  }),

  operators: z
    .object({
      common: z.array(OperatorSchema).optional(),
      ordered: z.array(OperatorSchema).optional(),
      presence: z.array(OperatorSchema).optional(),
      boolean: z.array(OperatorSchema).optional(),
    })
    .optional(),

  operatorArity: OperatorAritySchema,
  valueTypeContracts: ValueTypeContractsSchema,

  tiers: z
    .object({
      FAST: z.object({ description: z.string().min(1) }),
      SNAPSHOT: z.object({ description: z.string().min(1) }),
    })
    .optional(),

  sources: z.record(SourceDeclSchema),
  joinSpecs: z.record(JoinSpecSchema),
  joinNegationPolicy: JoinNegationPolicySchema.optional(),

  snapshotCompile: SnapshotCompileSchema,

  filters: z.array(FilterDefSchema).min(1),

  integrity: z
    .object({
      noDriftRules: z.array(z.string().min(1)).optional(),
    })
    .optional(),
});

export type FilterDef = z.infer<typeof FilterDefSchema>;
export type FilterRegistry = z.infer<typeof RegistrySchema>;

// Optional telemetry hook for unknown keys (e.g., wire to Sentry later without coupling).
export type RegistryTelemetry = {
  onUnknownKey?: (info: { key: string; op?: string; scope?: string; where: "getFilterDef" | "assertLeafAllowed" }) => void;
};

let _cached:
  | { reg: FilterRegistry; byKey: Map<string, FilterDef>; hash: string; telemetry: RegistryTelemetry; gidRegex: RegExp }
  | null = null;

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

function registryPath(): string {
  return path.resolve(process.cwd(), "web/config/filterRegistry.v1.json");
}

function buildSourcesByTable(reg: FilterRegistry): Map<string, { name: string; decl: z.infer<typeof SourceDeclSchema> }> {
  const out = new Map<string, { name: string; decl: z.infer<typeof SourceDeclSchema> }>();
  for (const [name, decl] of Object.entries(reg.sources)) {
    out.set(decl.table, { name, decl });
  }
  return out;
}

function applySemanticsDefaults(reg: FilterRegistry, f: FilterDef): FilterDef {
  const s = f.semantics;

  if (s.derivedFrom !== "VARIANTS") {
    // Non-variant-derived: quantifier/atomicity must be explicitly present for no-drift.
    if (!s.quantifier) throw new Error(`filter registry: semantics.quantifier required (derivedFrom=NONE): ${f.key}`);
    if (!s.atomicity) throw new Error(`filter registry: semantics.atomicity required (derivedFrom=NONE): ${f.key}`);
    return f;
  }

  // Variant-derived: fill missing from registry defaults.
  const quantifier = s.quantifier ?? reg.defaults.variantQuantifierDefault;
  const atomicity = s.atomicity ?? reg.defaults.variantAtomicityDefault;

  return {
    ...f,
    semantics: {
      ...s,
      quantifier,
      atomicity,
    },
  };
}

function validateRegistryInvariants(reg: FilterRegistry) {
  // Validate gid regex compiles
  try {
    // eslint-disable-next-line no-new
    new RegExp(reg.valueTypeContracts.gid.pattern);
  } catch (e: any) {
    throw new Error(`filter registry: invalid gid.pattern regex: ${String(e?.message || e)}`);
  }

  const sourcesByTable = buildSourcesByTable(reg);

  // joinSpecs tables must be declared (binding is by SQL table name, not by sources key)
  for (const [name, js] of Object.entries(reg.joinSpecs)) {
    if (!sourcesByTable.has(js.leftTable)) {
      throw new Error(`filter registry: joinSpec ${name} leftTable not declared in sources: ${js.leftTable}`);
    }
    if (!sourcesByTable.has(js.rightTable)) {
      throw new Error(`filter registry: joinSpec ${name} rightTable not declared in sources: ${js.rightTable}`);
    }
  }

  const byKey = new Map<string, FilterDef>();
  for (const f0 of reg.filters) {
    if (byKey.has(f0.key)) throw new Error(`filter registry: duplicate key: ${f0.key}`);

    const f = applySemanticsDefaults(reg, f0);
    byKey.set(f.key, f);

    // Enum valueType requires enumValues
    if (f.valueType === "enum" && (!f.enumValues || f.enumValues.length === 0)) {
      throw new Error(`filter registry: enum filter missing enumValues: ${f.key}`);
    }

    // Operator arity must exist for every operator listed
    for (const op of f.operators) {
      const ar = reg.operatorArity[op];
      if (ar === undefined) throw new Error(`filter registry: operatorArity missing for op=${op} (filter=${f.key})`);
    }

    // FAST filters must declare a source.
    if (f.tier === "FAST" && !f.source) throw new Error(`filter registry: FAST filter missing source: ${f.key}`);

    // SNAPSHOT filters must declare snapshot metadata.
    if (f.tier === "SNAPSHOT" && !f.snapshot) throw new Error(`filter registry: SNAPSHOT filter missing snapshot metadata: ${f.key}`);

    // FAST source integrity
    if (f.tier === "FAST" && f.source) {
      const srcTable = f.source.table;
      const srcDecl = sourcesByTable.get(srcTable);
      if (!srcDecl) throw new Error(`filter registry: FAST source table not declared in sources: ${f.key} table=${srcTable}`);

      if (f.source.kind === "column") {
        if (!srcDecl.decl.requiredColumns.includes(f.source.column)) {
          throw new Error(
            `filter registry: FAST column not in sources.requiredColumns: ${f.key} table=${srcTable} column=${f.source.column}`
          );
        }
      }

      if (f.source.kind === "join") {
        // join filters: only membership semantics via in/nin
        const ok = f.operators.every((op) => op === "in" || op === "nin");
        if (!ok) throw new Error(`filter registry: join filter must only support in/nin: ${f.key}`);

        const negPolicy = f.joinSemantics?.negation ?? reg.joinNegationPolicy?.default ?? "NOT_EXISTS";
        if (negPolicy !== "NOT_EXISTS") throw new Error(`filter registry: unsupported join negation policy: ${f.key} negation=${negPolicy}`);

        // joinSpec must exist and must bind deterministically to this join table
        const js = reg.joinSpecs[f.source.joinSpec];
        if (!js) throw new Error(`filter registry: join filter missing/invalid source.joinSpec: ${f.key} joinSpec=${f.source.joinSpec}`);
        if (js.rightTable !== srcTable) {
          throw new Error(
            `filter registry: joinSpec rightTable mismatch: ${f.key} joinSpec=${f.source.joinSpec} expectedRightTable=${srcTable} got=${js.rightTable}`
          );
        }

        if (!srcDecl.decl.requiredColumns.includes(f.source.column)) {
          throw new Error(
            `filter registry: JOIN column not in sources.requiredColumns: ${f.key} table=${srcTable} column=${f.source.column}`
          );
        }
      }
    }

    // SNAPSHOT compile integrity
    if (f.tier === "SNAPSHOT" && f.snapshot) {
      const sc = reg.snapshotCompile;
      const s = f.snapshot;

      if (!sc.strategies.includes(s.strategy)) {
        throw new Error(`filter registry: snapshot strategy not allowed by snapshotCompile: ${f.key} strategy=${s.strategy}`);
      }

      if (s.strategy === "SHOPIFY_SEARCH") {
        if (!s.queryTemplate || s.queryTemplate.trim().length === 0) {
          throw new Error(`filter registry: SNAPSHOT SHOPIFY_SEARCH missing queryTemplate: ${f.key}`);
        }
      }

      if (s.strategy === "BULKOP") {
        if (!s.bulkShape) throw new Error(`filter registry: SNAPSHOT BULKOP missing bulkShape: ${f.key}`);
        if (!sc.bulkShapes[s.bulkShape]) throw new Error(`filter registry: snapshot bulkShape not found: ${f.key} bulkShape=${s.bulkShape}`);
        if (!s.postFilter) throw new Error(`filter registry: SNAPSHOT BULKOP missing postFilter (deterministic): ${f.key}`);
      }

      // Fallback integrity if present
      if (s.fallback) {
        if (!sc.strategies.includes(s.fallback.strategy)) {
          throw new Error(
            `filter registry: snapshot fallback strategy not allowed by snapshotCompile: ${f.key} strategy=${s.fallback.strategy}`
          );
        }
        if (s.fallback.strategy === "SHOPIFY_SEARCH" && (!s.fallback.queryTemplate || s.fallback.queryTemplate.trim().length === 0)) {
          throw new Error(`filter registry: snapshot fallback SHOPIFY_SEARCH missing queryTemplate: ${f.key}`);
        }
        if (s.fallback.strategy === "BULKOP") {
          if (!s.fallback.bulkShape) throw new Error(`filter registry: snapshot fallback BULKOP missing bulkShape: ${f.key}`);
          if (!sc.bulkShapes[s.fallback.bulkShape]) {
            throw new Error(`filter registry: snapshot fallback bulkShape not found: ${f.key} bulkShape=${s.fallback.bulkShape}`);
          }
          if (!s.fallback.postFilter) throw new Error(`filter registry: snapshot fallback BULKOP missing postFilter: ${f.key}`);
        }
      }
    }
  }
}

function ensureCached() {
  if (_cached) return;

  const raw = fs.readFileSync(registryPath(), "utf8");
  const parsed = JSON.parse(raw);

  const reg0 = RegistrySchema.parse(parsed);

  // Validate invariants
  validateRegistryInvariants(reg0);

  // Materialize defaults into the cached registry filters so downstream sees canonical semantics.
  const reg: FilterRegistry = {
    ...reg0,
    filters: reg0.filters.map((f) => applySemanticsDefaults(reg0, f)),
  };

  const byKey = new Map<string, FilterDef>();
  for (const f of reg.filters) byKey.set(f.key, f);

  const hash = sha256Hex(stableStringify(reg));

  // Compile GID regex once (used by coerceAndValidateValue)
  const gidRegex = new RegExp(reg.valueTypeContracts.gid.pattern);

  _cached = { reg, byKey, hash, telemetry: {}, gidRegex };
}

/**
 * Optionally set telemetry hooks (e.g., Sentry capture) without coupling registry.ts to any vendor.
 * Call this once at boot (before planning) if you want telemetry.
 */
export function setRegistryTelemetry(t: RegistryTelemetry) {
  ensureCached();
  _cached!.telemetry = t || {};
}

export function loadFilterRegistry(): FilterRegistry {
  ensureCached();
  return _cached!.reg;
}

export function registryHash(): string {
  ensureCached();
  return _cached!.hash;
}

// -----------------------------
// Requested “gatekeeper” API
// -----------------------------

export function getFilterSpec(key: string): FilterDef {
  return getFilterDef(key);
}

export function getFilterDef(key: string): FilterDef {
  ensureCached();
  const def = _cached!.byKey.get(key);
  if (!def) {
    _cached!.telemetry.onUnknownKey?.({ key, where: "getFilterDef" });
    throw new Error(`Unknown filter key: ${key}`);
  }
  return def;
}

export function assertOperatorAllowed(key: string, op: string): void {
  const def = getFilterDef(key);
  if (!def.operators.includes(op as Operator)) {
    throw new Error(`Operator not allowed: key=${key} op=${op}`);
  }
}

export function operatorArity(op: string): 0 | 1 | 2 | "N" {
  const reg = loadFilterRegistry();
  const ar = reg.operatorArity[op as Operator];
  if (ar === undefined) throw new Error(`Unknown operator: ${op}`);
  return ar;
}

export function assertArity(op: string, value: any): void {
  const ar = operatorArity(op);

  if (ar === 0) {
    if (value !== undefined && value !== null) {
      throw new Error(`Operator ${op} expects no value`);
    }
    return;
  }

  if (ar === 1) {
    if (value === undefined) throw new Error(`Operator ${op} expects 1 value`);
    if (Array.isArray(value)) throw new Error(`Operator ${op} expects scalar value, got array`);
    return;
  }

  if (ar === 2) {
    if (!Array.isArray(value) || value.length !== 2) {
      throw new Error(`Operator ${op} expects [a,b]`);
    }
    return;
  }

  // ar === "N"
  if (value === undefined) throw new Error(`Operator ${op} expects array value`);
  if (!Array.isArray(value)) throw new Error(`Operator ${op} expects array value`);
}

/**
 * Coerce + validate a raw value against registry valueTypeContracts.
 *
 * No-drift principle:
 * - Coercion is deterministic and minimal (string/number/bool normalization).
 * - It does NOT interpret “business meaning” (e.g., does not parse GID -> bigint); that belongs
 *   in tier-specific compilers/evaluators to avoid cross-tier coupling.
 */
export function coerceAndValidateValue(valueType: ValueType, rawValue: any): any {
  ensureCached();
  const reg = _cached!.reg;

  switch (valueType) {
    case "string": {
      if (rawValue === null || rawValue === undefined) return "";
      return String(rawValue);
    }

    case "enum": {
      if (rawValue === null || rawValue === undefined) return "";
      return String(rawValue);
    }

    case "gid": {
      if (rawValue === null || rawValue === undefined) throw new Error(`ValueType gid: missing value`);
      const s = String(rawValue);
      if (!_cached!.gidRegex.test(s)) throw new Error(`ValueType gid: invalid format`);
      return s;
    }

    case "datetime": {
      if (rawValue === null || rawValue === undefined) throw new Error(`ValueType datetime: missing value`);
      const s = String(rawValue);
      // Deterministic ISO8601 check (sufficient for contract; DB casts/Shopify parsing happen later)
      const ms = Date.parse(s);
      if (!Number.isFinite(ms)) throw new Error(`ValueType datetime: invalid iso8601`);
      // Keep original string to avoid timezone re-serialization drift
      return s;
    }

    case "number": {
      if (rawValue === null || rawValue === undefined) throw new Error(`ValueType number: missing value`);
      const n = typeof rawValue === "number" ? rawValue : Number(String(rawValue));
      if (!Number.isFinite(n)) throw new Error(`ValueType number: not a finite number`);
      return n;
    }

    case "money": {
      if (rawValue === null || rawValue === undefined) throw new Error(`ValueType money: missing value`);
      const n = typeof rawValue === "number" ? rawValue : Number(String(rawValue));
      if (!Number.isFinite(n)) throw new Error(`ValueType money: not a finite number`);
      return n;
    }

    case "boolean": {
      if (typeof rawValue === "boolean") return rawValue;
      if (rawValue === 1 || rawValue === "1" || rawValue === "true") return true;
      if (rawValue === 0 || rawValue === "0" || rawValue === "false") return false;
      throw new Error(`ValueType boolean: expected boolean`);
    }

    case "metafield": {
      const mf = MetafieldContractSchema.safeParse(rawValue);
      if (!mf.success) {
        throw new Error(`ValueType metafield: does not match contract: ${mf.error.message}`);
      }
      return mf.data;
    }

    default: {
      // Exhaustive guard
      const neverType: never = valueType;
      throw new Error(`Unknown valueType: ${String(neverType)}`);
    }
  }
}

// -----------------------------
// Convenience helpers
// -----------------------------

export function isFastKey(key: string): boolean {
  return getFilterDef(key).tier === "FAST";
}

export function isSnapshotKey(key: string): boolean {
  return getFilterDef(key).tier === "SNAPSHOT";
}

export function isOperatorAllowed(key: string, op: string): boolean {
  const def = getFilterDef(key);
  return def.operators.includes(op as Operator);
}

/**
 * Validate a leaf against registry:
 * - key exists
 * - operator allowed
 * - arity satisfied
 * - metafield payload validated when applicable
 *
 * Note: This does not coerce scalar types for SQL/Shopify (tier-specific modules do that).
 */
export function assertLeafAllowed(input: { key: string; op: string; value?: any }) {
  ensureCached();

  const def = _cached!.byKey.get(input.key);
  if (!def) {
    _cached!.telemetry.onUnknownKey?.({ key: input.key, op: input.op, where: "assertLeafAllowed" });
    throw new Error(`Unknown filter key: ${input.key}`);
  }

  assertOperatorAllowed(input.key, input.op);
  assertArity(input.op, input.value);

  // Metafield value contract (only for scalar-arity ops; for "N" you may later support arrays explicitly)
  if (def.valueType === "metafield") {
    const ar = operatorArity(input.op);
    if (ar !== 1) {
      throw new Error(`Metafield filters currently require scalar arity operators (key=${input.key} op=${input.op})`);
    }
    const mf = MetafieldContractSchema.safeParse(input.value);
    if (!mf.success) {
      throw new Error(`Metafield value does not match contract (key=${input.key}): ${mf.error.message}`);
    }
  }
}

export function listFilters(): FilterDef[] {
  ensureCached();
  return Array.from(_cached!.byKey.values());
}
