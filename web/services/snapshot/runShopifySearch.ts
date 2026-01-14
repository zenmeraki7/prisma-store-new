// web/services/snapshot/runShopifySearch.ts
//
// Snapshot builder (SHOPIFY_SEARCH strategy):
// - Executes Shopify Admin GraphQL product search with cursor paging
// - Writes matching productIds into Redis SET (decimal BIGINT strings)
// - Enforces hard caps (maxPages / maxProducts) to prevent runaway scans
// - Aligns TTL across snapshot keys (status/meta/set/(cursor)) to guarantee deterministic eviction
//
// Eviction semantics (DROP, not re-eval):
// - When TTL expires, Redis keys disappear.
// - Next request for the same snapshotId (planHash-bound) simply rebuilds the set end-to-end.
// - No attempt is made to "incrementally re-evaluate" expired snapshots.
//
// IMPORTANT:
// - product IDs are stored as BIGINT-safe DECIMAL STRINGS (no JS number parsing).
// - This function is idempotent:
//   * If status is READY, it no-ops.
//   * If status is RUNNING, it continues from stored cursor if present.
//
// ESM TypeScript.

import type { Redis } from "ioredis";
import { parseShopifyGidToBigintString } from "../../shopify/graphqlClient"; // adjust if your path differs

// If you already have snapshot.state.ts / snapshot.keys.ts, prefer importing these instead.
// Keep these helpers consistent with orchestrator.ts to prevent drift.
function redis_key_snapshot_status(input: { shopId: string; snapshotId: string }) {
  return `snap:v1:${input.shopId}:${input.snapshotId}:status`;
}
function redis_key_snapshot_meta(input: { shopId: string; snapshotId: string }) {
  return `snap:v1:${input.shopId}:${input.snapshotId}:meta`;
}
function redis_key_snapshot_set(input: { shopId: string; snapshotId: string }) {
  return `snap:v1:${input.shopId}:${input.snapshotId}:set`;
}
function redis_key_snapshot_cursor(input: { shopId: string; snapshotId: string }) {
  return `snap:v1:${input.shopId}:${input.snapshotId}:cursor`;
}

export type SnapshotStatus = "CREATED" | "RUNNING" | "READY" | "FAILED";

export type ShopifySearchInput = {
  shopId: string;
  shop: string;
  snapshotId: string;

  // Deterministic binding (observability + replay defense)
  planHash: string;
  registryHash: string;

  // Shopify search query (e.g. "status:active AND updated_at:>'2026-01-01T00:00:00Z'")
  query: string;

  ttlSeconds: number;

  // Paging + caps
  pageSize?: number; // default 100 (max 250)
  maxPages?: number; // default 200
  maxProducts?: number; // default 500_000

  // Optional: start from cursor (overrides stored cursor if provided)
  startCursor?: string | null;

  log?: {
    info: (obj: any, msg?: string) => void;
    warn: (obj: any, msg?: string) => void;
    error: (obj: any, msg?: string) => void;
  };
};

export type ShopifySearchDeps = {
  redis: Redis;
  graphql: {
    // Must match your graphqlClient.ts client.query signature
    query: <T = any>(query: string, variables?: Record<string, any>) => Promise<T>;
  };
};

export type ShopifySearchResult = {
  ok: true;
  status: "READY";
  snapshotId: string;
  cardinality: number;
  scanned: number;
  pages: number;
  lastCursor: string | null;
};

function clampInt(n: any, lo: number, hi: number, dflt: number): number {
  const v = Number(n ?? dflt);
  if (!Number.isFinite(v)) return dflt;
  return Math.max(lo, Math.min(hi, Math.trunc(v)));
}

function normalizeTtlSeconds(ttlSeconds: any): number {
  // Keep aligned with orchestrator bounds (60..86400)
  return clampInt(ttlSeconds, 60, 86400, 900);
}

function normalizePageSize(n: any): number {
  return clampInt(n, 1, 250, 100);
}

function asStringOrNull(v: any): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v);
  return s.length ? s : null;
}

// GraphQL: Shopify Admin product search with cursor paging
const SHOPIFY_SEARCH_QUERY = `
query SnapshotSearch($first: Int!, $after: String, $query: String!) {
  products(first: $first, after: $after, query: $query) {
    pageInfo { hasNextPage }
    edges {
      cursor
      node { id }
    }
  }
}
`.trim();

/**
 * Build snapshot set via Shopify Search.
 * Writes:
 * - statusKey: RUNNING -> READY/FAILED (ttl)
 * - metaKey: hashes + progress (ttl)
 * - setKey: product_id decimal strings (ttl)
 * - cursorKey: last cursor (ttl) (for resumability)
 */
export async function runShopifySearch(deps: ShopifySearchDeps, input: ShopifySearchInput): Promise<ShopifySearchResult> {
  const log =
    input.log ??
    ({
      info: () => {},
      warn: () => {},
      error: () => {},
    } as any);

  if (!input.shopId) throw new Error("runShopifySearch: missing shopId");
  if (!input.snapshotId) throw new Error("runShopifySearch: missing snapshotId");

  const ttl = normalizeTtlSeconds(input.ttlSeconds);
  const pageSize = normalizePageSize(input.pageSize);
  const maxPages = clampInt(input.maxPages, 1, 10_000, 200);
  const maxProducts = clampInt(input.maxProducts, 1, 5_000_000, 500_000);

  const statusKey = redis_key_snapshot_status({ shopId: input.shopId, snapshotId: input.snapshotId });
  const metaKey = redis_key_snapshot_meta({ shopId: input.shopId, snapshotId: input.snapshotId });
  const setKey = redis_key_snapshot_set({ shopId: input.shopId, snapshotId: input.snapshotId });
  const cursorKey = redis_key_snapshot_cursor({ shopId: input.shopId, snapshotId: input.snapshotId });

  // If already READY, no-op (idempotent)
  const existingStatus = (await deps.redis.get(statusKey)) as SnapshotStatus | null;
  if (existingStatus === "READY") {
    const card = await deps.redis.scard(setKey);
    return {
      ok: true,
      status: "READY",
      snapshotId: input.snapshotId,
      cardinality: Number(card ?? 0),
      scanned: 0,
      pages: 0,
      lastCursor: asStringOrNull(await deps.redis.get(cursorKey)),
    };
  }

  // Initialize (or reaffirm) RUNNING + TTL alignment across keys
  {
    const pipeline = deps.redis.pipeline();
    pipeline.set(statusKey, "RUNNING", "EX", ttl);
    pipeline.hset(metaKey, {
      shopId: input.shopId,
      snapshotId: input.snapshotId,
      planHash: input.planHash,
      registryHash: input.registryHash,
      mode: "SHOPIFY_SEARCH",
      query: input.query,
      startedAt: new Date().toISOString(),
      // will be updated continuously:
      scanned: "0",
      pages: "0",
      cardinality: "0",
      lastCursor: "",
    });
    pipeline.expire(metaKey, ttl);
    pipeline.expire(setKey, ttl);
    pipeline.expire(cursorKey, ttl);
    await pipeline.exec();
  }

  // Resume cursor:
  // - explicit startCursor wins
  // - else use stored cursor (if any)
  // - else null (fresh)
  let cursor: string | null = input.startCursor ?? asStringOrNull(await deps.redis.get(cursorKey));

  let scanned = 0;
  let pages = 0;

  try {
    for (let page = 0; page < maxPages; page++) {
      if (scanned >= maxProducts) {
        log.warn({ shopId: input.shopId, snapshotId: input.snapshotId, scanned, maxProducts }, "snapshot maxProducts reached");
        break;
      }

      const data: any = await deps.graphql.query<any>(SHOPIFY_SEARCH_QUERY, {
        first: pageSize,
        after: cursor,
        query: input.query,
      });

      const products = data?.products;
      const edges = Array.isArray(products?.edges) ? products.edges : [];
      const hasNextPage = Boolean(products?.pageInfo?.hasNextPage);

      if (edges.length === 0) {
        cursor = null;
        break;
      }

      pages++;

      // Convert Shopify GID -> BIGINT decimal string; ignore malformed nodes defensively.
      const ids: string[] = [];
      let lastEdgeCursor: string | null = null;

      for (const e of edges) {
        const gid = e?.node?.id;
        if (gid) {
          ids.push(parseShopifyGidToBigintString(String(gid), { label: "Product.id" }));
        }
        if (e?.cursor) lastEdgeCursor = String(e.cursor);
      }

      scanned += edges.length;
      cursor = lastEdgeCursor;

      // Deterministic writes:
      // - SADD in pipeline
      // - update cursorKey
      // - refresh TTL on all keys to guarantee full-window validity during long builds
      const pipe = deps.redis.pipeline();

      if (ids.length > 0) {
        // SADD is idempotent; duplicates are ignored by Redis.
        // Note: We intentionally store DECIMAL strings, not numbers.
        pipe.sadd(setKey, ...ids);
      }

      if (cursor) {
        pipe.set(cursorKey, cursor, "EX", ttl);
      } else {
        // keep key present for TTL alignment even if null
        pipe.set(cursorKey, "", "EX", ttl);
      }

      // refresh TTL alignment each page (long jobs must not partially expire)
      pipe.expire(statusKey, ttl);
      pipe.expire(metaKey, ttl);
      pipe.expire(setKey, ttl);
      pipe.expire(cursorKey, ttl);

      // update meta progress (avoid expensive SCARD every page; do it periodically)
      const shouldCard = page % 10 === 0; // every 10 pages
      if (shouldCard) {
        pipe.scard(setKey);
      }

      const execRes = await pipe.exec();

      // Resolve cardinality if computed
      let cardinality: number | null = null;
      if (shouldCard && Array.isArray(execRes)) {
        const last = execRes[execRes.length - 1]?.[1];
        if (typeof last === "number") cardinality = last;
        else if (last !== null && last !== undefined) cardinality = Number(last);
        if (!Number.isFinite(cardinality as any)) cardinality = null;
      }

      // Persist meta progress
      const metaPipe = deps.redis.pipeline();
      metaPipe.hset(metaKey, {
        scanned: String(scanned),
        pages: String(pages),
        lastCursor: cursor ?? "",
        cardinality: cardinality !== null ? String(cardinality) : undefined,
      });
      metaPipe.expire(metaKey, ttl);
      await metaPipe.exec();

      if (!hasNextPage || !cursor) break;
    }

    const finalCard = await deps.redis.scard(setKey);

    // Mark READY + TTL alignment
    const done = deps.redis.pipeline();
    done.set(statusKey, "READY", "EX", ttl);
    done.hset(metaKey, {
      finishedAt: new Date().toISOString(),
      status: "READY",
      scanned: String(scanned),
      pages: String(pages),
      lastCursor: cursor ?? "",
      cardinality: String(finalCard ?? 0),
    });
    done.expire(metaKey, ttl);
    done.expire(setKey, ttl);
    done.expire(cursorKey, ttl);
    await done.exec();

    log.info(
      { shopId: input.shopId, snapshotId: input.snapshotId, scanned, pages, cardinality: Number(finalCard ?? 0) },
      "snapshot READY (SHOPIFY_SEARCH)"
    );

    return {
      ok: true,
      status: "READY",
      snapshotId: input.snapshotId,
      cardinality: Number(finalCard ?? 0),
      scanned,
      pages,
      lastCursor: cursor,
    };
  } catch (e: any) {
    const msg = String(e?.message || e);

    // Mark FAILED + TTL alignment
    const fail = deps.redis.pipeline();
    fail.set(statusKey, "FAILED", "EX", ttl);
    fail.hset(metaKey, {
      finishedAt: new Date().toISOString(),
      status: "FAILED",
      error: msg,
      scanned: String(scanned),
      pages: String(pages),
      lastCursor: cursor ?? "",
    });
    fail.expire(metaKey, ttl);
    fail.expire(setKey, ttl);
    fail.expire(cursorKey, ttl);
    await fail.exec();

    log.error({ shopId: input.shopId, snapshotId: input.snapshotId, err: msg }, "snapshot FAILED (SHOPIFY_SEARCH)");
    throw e;
  }
}
