// web/services/snapshot/eval.snapshot.ts
//
// Deterministic SNAPSHOT compilation + local evaluator for BulkOp records (no drift).
//
// Input: snapshot leaves (already validated by planner/registry)
// Output:
//   - Either a Shopify Search query (mode=SHOPIFY_SEARCH)
//   - Or a BulkOp shape + a deterministic local predicate (mode=BULKOP)
//
// IMPORTANT (current planner behavior):
// - If your planner flattens the DSL and loses AND/OR grouping,
//   this evaluator treats snapshot leaves as an AND-conjunction.
// - If/when you preserve boolean structure, extend this file with a tree evaluator.
//
// ESM TypeScript.

import { getFilterDef, loadFilterRegistry, type FilterRegistry } from "../filters/registry";
import type { PlanLeaf } from "../filters/planner";

export type SnapshotMode = "SHOPIFY_SEARCH" | "BULKOP";

export type SnapshotSearchPlan = {
  mode: "SHOPIFY_SEARCH";
  query: string;
  keys: string[];
};

export type SnapshotBulkPlan = {
  mode: "BULKOP";
  bulkShape: string; // registry-defined (e.g. "PRODUCTS_ONLY" | "PRODUCTS_WITH_VARIANTS")
  predicate: (rec: SnapshotProductRecord) => boolean;
  keys: string[];
};

export type SnapshotPlan = SnapshotSearchPlan | SnapshotBulkPlan;

/**
 * Minimal record shape expected from your BulkOp assembler.
 * Keep this aligned with your registry.snapshotCompile.bulkShapes.
 */
export type SnapshotMetafield = {
  namespace: string;
  key: string;
  type?: string | null;
  value?: string | null;
};

export type SnapshotVariantRecord = {
  id: string;

  sku?: string | null;
  barcode?: string | null;
  title?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;

  price?: string | number | null;
  compareAtPrice?: string | number | null;
  weight?: string | number | null;

  requiresShipping?: boolean | null;
  taxable?: boolean | null;
  inventoryPolicy?: string | null;

  inventoryItem?: { tracked?: boolean | null } | null;

  selectedOptions?: Array<{ name: string; value: string }> | null;

  metafields?: SnapshotMetafield[] | null;
};

export type SnapshotProductRecord = {
  id: string;

  title?: string | null;
  handle?: string | null;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  publishedAt?: string | null;

  templateSuffix?: string | null;
  descriptionHtml?: string | null;

  seo?: any;
  onlineStoreUrl?: string | null;

  metafields?: SnapshotMetafield[] | null;

  variants?: SnapshotVariantRecord[] | null;
};

// Registry metafield leaf value (valueTypeContracts.metafield)
export type MetafieldLeafValue = {
  namespace: string;
  key: string;
  op: "eq" | "neq" | "in" | "nin";
  value: string; // "no drift string value" rule
};

// -----------------------------
// Small helpers
// -----------------------------

function asArray(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (v === undefined || v === null) return [];
  return [v];
}

function toLowerMaybe(s: any, caseSensitive?: boolean): string {
  const str = s === null || s === undefined ? "" : String(s);
  return caseSensitive ? str : str.toLowerCase();
}

function coerceNumber(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : null;
}

function coerceIsoMs(v: any): number | null {
  if (!v) return null;
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : null;
}

function matchEqOrInString(input: any, leaf: PlanLeaf, caseSensitive?: boolean): boolean {
  const s = toLowerMaybe(input, caseSensitive);

  if (leaf.op === "eq") {
    const wanted = toLowerMaybe(leaf.value, caseSensitive);
    return s === wanted;
  }
  if (leaf.op === "in") {
    const xs = asArray(leaf.value).map((x) => toLowerMaybe(x, caseSensitive));
    if (xs.length === 0) return false;
    return xs.includes(s);
  }
  if (leaf.op === "neq") {
    const wanted = toLowerMaybe(leaf.value, caseSensitive);
    return s !== wanted;
  }
  if (leaf.op === "nin") {
    const xs = asArray(leaf.value).map((x) => toLowerMaybe(x, caseSensitive));
    if (xs.length === 0) return true;
    return !xs.includes(s);
  }

  throw new Error(`LOCAL_EVAL EQ_OR_IN_STRING: unsupported op=${leaf.op} key=${leaf.key}`);
}

function matchBoolIs(input: any, leaf: PlanLeaf): boolean {
  if (leaf.op !== "is") throw new Error(`LOCAL_EVAL BOOL_IS: unsupported op=${leaf.op} key=${leaf.key}`);
  return Boolean(input) === Boolean(leaf.value);
}

function matchPresentBool(input: any, leaf: PlanLeaf): boolean {
  if (leaf.op !== "is") throw new Error(`LOCAL_EVAL PRESENT_BOOL: unsupported op=${leaf.op} key=${leaf.key}`);
  const present = input !== null && input !== undefined && String(input).trim().length > 0;
  return present === Boolean(leaf.value);
}

function matchRangeNumeric(input: any, leaf: PlanLeaf, coerce?: "NUMBER"): boolean {
  const n = coerce === "NUMBER" ? coerceNumber(input) : coerceNumber(input);
  if (n === null) return false;

  if (leaf.op === "gte") return n >= coerceNumber(leaf.value)!;
  if (leaf.op === "lte") return n <= coerceNumber(leaf.value)!;
  if (leaf.op === "between") {
    const [a, b] = asArray(leaf.value);
    const lo = coerceNumber(a);
    const hi = coerceNumber(b);
    if (lo === null || hi === null) return false;
    return n >= lo && n <= hi;
  }

  throw new Error(`LOCAL_EVAL RANGE_NUMERIC: unsupported op=${leaf.op} key=${leaf.key}`);
}

function matchRangeDatetime(input: any, leaf: PlanLeaf): boolean {
  const t = coerceIsoMs(input);
  if (t === null) return false;

  if (leaf.op === "gte") return t >= coerceIsoMs(leaf.value)!;
  if (leaf.op === "lte") return t <= coerceIsoMs(leaf.value)!;
  if (leaf.op === "between") {
    const [a, b] = asArray(leaf.value);
    const lo = coerceIsoMs(a);
    const hi = coerceIsoMs(b);
    if (lo === null || hi === null) return false;
    return t >= lo && t <= hi;
  }

  throw new Error(`LOCAL_EVAL RANGE_DATETIME: unsupported op=${leaf.op} key=${leaf.key}`);
}

/**
 * Deterministic metafield match:
 * - Find metafield by (namespace,key)
 * - Compare string value according to op
 * NOTE: registry contract says metafield value treated as string for no-drift.
 */
function matchMetafield(metafields: SnapshotMetafield[] | null | undefined, leaf: PlanLeaf): boolean {
  const mv = leaf.value as MetafieldLeafValue | undefined;
  if (!mv || typeof mv !== "object") return false;

  const list = metafields ?? [];
  const found = list.find((m) => m.namespace === mv.namespace && m.key === mv.key);
  const actualStr = String(found?.value ?? "");
  const wanted = String(mv.value ?? "");

  switch (mv.op) {
    case "eq":
      return actualStr === wanted;
    case "neq":
      return actualStr !== wanted;
    case "in":
      // Contract: value is string (no arrays) to prevent drift.
      return actualStr === wanted;
    case "nin":
      return actualStr !== wanted;
    default:
      return false;
  }
}

function localEvalProduct(rec: SnapshotProductRecord, leaf: PlanLeaf, spec: any): boolean {
  const match = spec?.match as string | undefined;

  switch (match) {
    case "EQ_OR_IN_STRING":
      return matchEqOrInString(getPath(rec, spec.path), leaf, spec.caseSensitive);
    case "BOOL_IS":
      return matchBoolIs(getPath(rec, spec.path), leaf);
    case "PRESENT_BOOL":
      return matchPresentBool(getPath(rec, spec.path), leaf);
    case "RANGE_NUMERIC":
      return matchRangeNumeric(getPath(rec, spec.path), leaf, spec.coerce);
    case "RANGE_DATETIME":
      return matchRangeDatetime(getPath(rec, spec.path), leaf);

    case "SEO_VISIBILITY_BOOL": {
      if (leaf.op !== "is") throw new Error(`SEO_VISIBILITY_BOOL requires op=is key=${leaf.key}`);
      const seo = rec.seo;
      const visible = Boolean(
        seo &&
          (String(seo.title ?? "").trim().length > 0 ||
            String(seo.description ?? "").trim().length > 0 ||
            String(seo?.titleTag ?? "").trim().length > 0 ||
            String(seo?.descriptionTag ?? "").trim().length > 0)
      );
      return visible === Boolean(leaf.value);
    }

    case "POS_VISIBILITY_BOOL": {
      if (leaf.op !== "is") throw new Error(`POS_VISIBILITY_BOOL requires op=is key=${leaf.key}`);
      const visible = String(rec.status ?? "").toUpperCase() === "ACTIVE";
      return visible === Boolean(leaf.value);
    }

    case "METAFIELD_MATCH":
      return matchMetafield(rec.metafields ?? [], leaf);

    default:
      throw new Error(`Unsupported LOCAL_EVAL match=${match} for key=${leaf.key}`);
  }
}

function localEvalVariants(rec: SnapshotProductRecord, leaf: PlanLeaf, spec: any): boolean {
  const variants = rec.variants ?? [];
  const match = spec?.match as string | undefined;

  const quantifier = spec?.collapseToProductIds?.quantifier ?? "ANY"; // default ANY
  const any = (fn: (v: SnapshotVariantRecord) => boolean) => variants.some(fn);
  const all = (fn: (v: SnapshotVariantRecord) => boolean) => variants.length > 0 && variants.every(fn);

  const reduce = (fn: (v: SnapshotVariantRecord) => boolean) => {
    if (quantifier === "ALL") return all(fn);
    // SAME_VARIANT requires tree semantics; with flattened leaves, treat as ANY deterministically.
    return any(fn);
  };

  switch (match) {
    case "EQ_OR_IN_STRING": {
      const caseSensitive = spec.caseSensitive;
      const path = spec.path as string;
      return reduce((v) => matchEqOrInString(getPath({ variants: [v] } as any, path), leaf, caseSensitive));
    }

    case "RANGE_NUMERIC": {
      const path = spec.path as string;
      return reduce((v) => matchRangeNumeric(getPath({ variants: [v] } as any, path), leaf, spec.coerce));
    }

    case "RANGE_DATETIME": {
      const path = spec.path as string;
      return reduce((v) => matchRangeDatetime(getPath({ variants: [v] } as any, path), leaf));
    }

    case "BOOL_IS": {
      const path = spec.path as string;
      return reduce((v) => matchBoolIs(getPath({ variants: [v] } as any, path), leaf));
    }

    case "METAFIELD_MATCH":
      return reduce((v) => matchMetafield(v.metafields ?? [], leaf));

    default:
      throw new Error(`Unsupported variant LOCAL_EVAL match=${match} for key=${leaf.key}`);
  }
}

/**
 * Very small path helper for the specific paths used in your registry.
 * Intentionally limited to keep behavior deterministic and safe.
 */
function getPath(rec: any, pathExpr: string): any {
  if (!pathExpr) return undefined;

  // Product-level direct paths
  if (!pathExpr.includes("variants")) {
    return pathExpr.split(".").reduce((acc, k) => (acc == null ? undefined : acc[k]), rec);
  }

  // Variant-level: we are passed a wrapper like { variants: [v] }
  const v = rec?.variants?.[0];
  if (!v) return undefined;

  const p = pathExpr.replace("variants[].", "");
  return p.split(".").reduce((acc, k) => (acc == null ? undefined : acc[k]), v);
}

/**
 * Decide whether snapshot leaves can be expressed as a pure Shopify search query.
 * Rule:
 * - All leaves must be SNAPSHOT + strategy=SHOPIFY_SEARCH
 * - No leaf uses postFilter (LOCAL_EVAL) in its primary strategy
 */
function canUseShopifySearch(reg: FilterRegistry, leaves: PlanLeaf[]): boolean {
  for (const leaf of leaves) {
    const def = getFilterDef(leaf.key);
    if (def.tier !== "SNAPSHOT") return false;

    const s: any = def.snapshot;
    if (!s || s.strategy !== "SHOPIFY_SEARCH") return false;
    if (!s.queryTemplate || !String(s.queryTemplate).trim()) return false;
    if (s.postFilter) return false;
  }
  return true;
}

function buildShopifySearchQuery(leaves: PlanLeaf[]): SnapshotSearchPlan {
  const parts: string[] = [];
  const keys: string[] = [];

  for (const leaf of leaves) {
    const def = getFilterDef(leaf.key);
    const s: any = def.snapshot;

    const tpl = String(s.queryTemplate);
    keys.push(leaf.key);

    if (leaf.op === "eq") {
      parts.push(tpl.replace("{value}", String(leaf.value)));
      continue;
    }

    if (leaf.op === "in") {
      const xs = asArray(leaf.value);
      if (xs.length === 0) {
        parts.push("id:__never__");
        continue;
      }
      const orParts = xs.map((v) => tpl.replace("{value}", String(v)));
      parts.push(orParts.length === 1 ? orParts[0] : `(${orParts.join(" OR ")})`);
      continue;
    }

    throw new Error(`SHOPIFY_SEARCH unsupported op=${leaf.op} for key=${leaf.key}`);
  }

  return { mode: "SHOPIFY_SEARCH", query: parts.join(" AND "), keys };
}

/**
 * Choose the smallest BulkOp shape that can support all leaves deterministically.
 * Default heuristic:
 * - If any leaf is variant-derived OR uses variants[] path => PRODUCTS_WITH_VARIANTS
 * - Else PRODUCTS_ONLY
 *
 * NOTE: Your registry.snapshotCompile.bulkShapes is the source of truth;
 * this function only selects between the common two.
 */
function chooseBulkShape(reg: FilterRegistry, leaves: PlanLeaf[]): string {
  let needsVariants = false;

  for (const leaf of leaves) {
    const def = getFilterDef(leaf.key);
    const s: any = def.snapshot;

    const consider = (shape: any, postFilter: any) => {
      if (shape === "PRODUCTS_WITH_VARIANTS") needsVariants = true;
      if (postFilter?.path && String(postFilter.path).includes("variants")) needsVariants = true;
    };

    if (s?.strategy === "BULKOP") consider(s?.bulkShape, s?.postFilter);
    if (s?.fallback?.strategy === "BULKOP") consider(s.fallback.bulkShape, s.fallback.postFilter);

    if (leaf.key.startsWith("variant.")) needsVariants = true;
  }

  // Use the canonical shape names if present; else fallback to generic.
  const shapes = reg.snapshotCompile?.bulkShapes ?? {};
  if (needsVariants) {
    if (shapes["PRODUCTS_WITH_VARIANTS"]) return "PRODUCTS_WITH_VARIANTS";
    // fallback if registry uses different naming
    return Object.keys(shapes).find((k) => k.toLowerCase().includes("variant")) ?? "PRODUCTS_WITH_VARIANTS";
  }

  if (shapes["PRODUCTS_ONLY"]) return "PRODUCTS_ONLY";
  return Object.keys(shapes).find((k) => k.toLowerCase().includes("product")) ?? "PRODUCTS_ONLY";
}

function buildBulkPredicate(reg: FilterRegistry, leaves: PlanLeaf[]): (rec: SnapshotProductRecord) => boolean {
  const perLeafPredicates: Array<(rec: SnapshotProductRecord) => boolean> = [];

  for (const leaf of leaves) {
    const def = getFilterDef(leaf.key);
    const s: any = def.snapshot;

    // Effective strategy: prefer BULKOP; else SHOPIFY_SEARCH with BULKOP fallback.
    const effective =
      s?.strategy === "BULKOP"
        ? s
        : s?.strategy === "SHOPIFY_SEARCH" && s?.fallback?.strategy === "BULKOP"
          ? s.fallback
          : null;

    if (!effective) {
      throw new Error(`BULKOP predicate: no BULKOP strategy available for key=${leaf.key}`);
    }

    const postFilter = effective.postFilter ?? s?.postFilter;
    if (!postFilter || postFilter.op !== "LOCAL_EVAL") {
      throw new Error(`BULKOP predicate: missing LOCAL_EVAL postFilter for key=${leaf.key}`);
    }

    const isVariantPath = String(postFilter.path).includes("variants") || leaf.key.startsWith("variant.");

    if (postFilter.match === "METAFIELD_MATCH") {
      if (leaf.key === "variant.metafield") perLeafPredicates.push((rec) => localEvalVariants(rec, leaf, postFilter));
      else perLeafPredicates.push((rec) => localEvalProduct(rec, leaf, postFilter));
      continue;
    }

    if (isVariantPath) perLeafPredicates.push((rec) => localEvalVariants(rec, leaf, postFilter));
    else perLeafPredicates.push((rec) => localEvalProduct(rec, leaf, postFilter));
  }

  // AND-conjunction (planner currently flattens)
  return (rec: SnapshotProductRecord) => {
    for (const fn of perLeafPredicates) if (!fn(rec)) return false;
    return true;
  };
}

/**
 * Public entrypoint:
 * Compile snapshot leaves into an actionable plan.
 *
 * Determinism rules:
 * - If all leaves are SHOPIFY_SEARCH-only and require no LOCAL_EVAL => SHOPIFY_SEARCH plan
 * - Otherwise => BULKOP plan with a local predicate
 */
export function evalSnapshotDsl(input: { snapshotLeaves: PlanLeaf[]; registry?: FilterRegistry }): SnapshotPlan {
  const reg = input.registry ?? loadFilterRegistry();
  const leaves = input.snapshotLeaves ?? [];

  if (leaves.length === 0) {
    return { mode: "SHOPIFY_SEARCH", query: "", keys: [] };
  }

  // Strict: ensure only snapshot leaves enter here.
  for (const leaf of leaves) {
    const def = getFilterDef(leaf.key);
    if (def.tier !== "SNAPSHOT") {
      throw new Error(`evalSnapshotDsl: non-snapshot leaf passed in key=${leaf.key}`);
    }
  }

  if (canUseShopifySearch(reg, leaves)) {
    return buildShopifySearchQuery(leaves);
  }

  const bulkShape = chooseBulkShape(reg, leaves);
  const predicate = buildBulkPredicate(reg, leaves);

  return { mode: "BULKOP", bulkShape, predicate, keys: leaves.map((l) => l.key) };
}
