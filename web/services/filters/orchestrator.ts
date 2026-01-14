// web/services/filters/orchestrator.ts
//
// Updated orchestrator to enforce Option A: DROP semantics via snapshot.state.ts.
// Key changes vs your current version:
// - Uses readSnapshotState() which defines READY iff {status READY + meta exists + set exists}
// - If CORRUPT => dropSnapshot() and treat as MISSING (then enqueue + SNAPSHOT_BUSY)
// - If MISSING => enqueue if allowed + SNAPSHOT_BUSY
// - If BUSY => SNAPSHOT_BUSY
//
// The BIGINT cursor fix stays exactly as required.

import type { Queue } from "bullmq";
import type { Redis } from "ioredis";

import { planFilters, type FilterNode, type PlanLeaf } from "./planner";
import { compileFastWhere } from "./compiler.fast";
import { evalSnapshotDsl, type SnapshotPlan } from "../snapshot/eval.snapshot";

import {
  clampTtlSeconds,
  dropSnapshot,
  readSnapshotState,
  type SnapshotStatus,
} from "../snapshot/snapshot.state";
import { snapshot_set_key } from "../snapshot/snapshot.keys";

// -----------------------------
// Types
// -----------------------------

export type PgQueryFn = (sql: string, params: any[]) => Promise<{ rows: any[] }>;

export type OrchestratorDeps = {
  pg: { query: PgQueryFn };
  redis: Redis;
  queues: { snapshotScan: Queue };
  log?: {
    info: (obj: any, msg?: string) => void;
    warn: (obj: any, msg?: string) => void;
    error: (obj: any, msg?: string) => void;
  };
};

export type QueryInput = {
  shopId: string;
  shop: string;
  filter: FilterNode;

  limit?: number;
  after?: string | null; // cursor = last SCANNED product_id (decimal string)

  ttlSeconds?: number;
  allowEnqueueSnapshot?: boolean;
};

export type QueryOk = {
  ok: true;
  mode: "FAST_ONLY" | "FAST_PLUS_SNAPSHOT";
  productIds: string[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  meta: { planHash: string; registryHash: string; snapshotId?: string };
};

export type QueryBusy = {
  ok: false;
  code: "SNAPSHOT_BUSY";
  message: string;
  snapshotId: string;
  meta: { planHash: string; registryHash: string };
};

export type QueryResult = QueryOk | QueryBusy;

// -----------------------------
// Small utilities
// -----------------------------

function clampInt(n: any, min: number, max: number, fallback: number): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  const i = Math.trunc(x);
  return Math.max(min, Math.min(max, i));
}

function normalizeAfterBigIntCursor(after: any): string | null {
  if (after === null || after === undefined) return null;
  const s = String(after).trim();
  if (!s) return null;
  if (!/^\d+$/.test(s)) throw new Error(`Invalid cursor (after): expected decimal bigint string, got "${s}"`);
  return s;
}

// -----------------------------
// Orchestrator factory
// -----------------------------

export function createFilterOrchestrator(deps: OrchestratorDeps) {
  const log =
    deps.log ??
    ({
      info: () => {},
      warn: () => {},
      error: () => {},
    } as any);

  /**
   * Ensure snapshot exists/ready, or enqueue build job (deterministic).
   * Implements strict DROP semantics via readSnapshotState().
   */
  async function ensureSnapshotOrEnqueue(input: {
    shopId: string;
    shop: string;
    snapshotId: string;
    planHash: string;
    registryHash: string;
    snapshotPlan: SnapshotPlan;
    snapshotLeaves: PlanLeaf[];
    ttlSeconds: number;
    allowEnqueue: boolean;
  }): Promise<{ ready: true } | { ready: false; status: SnapshotStatus | "MISSING" | "CORRUPT" }> {
    // Read strict state
    const state = await readSnapshotState({
      redis: deps.redis,
      shopId: input.shopId,
      snapshotId: input.snapshotId,
    });

    if (state.kind === "READY") return { ready: true };

    // Corrupt READY must be dropped immediately (Option A)
    if (state.kind === "CORRUPT") {
      log.warn({ shopId: input.shopId, snapshotId: input.snapshotId, reason: state.reason }, "snapshot corrupt -> drop");
      await dropSnapshot({ redis: deps.redis, shopId: input.shopId, snapshotId: input.snapshotId });
      // Treat as missing thereafter
      if (!input.allowEnqueue) return { ready: false, status: "CORRUPT" as any };
    }

    // Busy or missing -> may enqueue
    if (!input.allowEnqueue) {
      return { ready: false, status: state.kind === "MISSING" ? ("MISSING" as any) : (state.status as any) };
    }

    const ttl = clampTtlSeconds(input.ttlSeconds, 900);

    const planInfo =
      input.snapshotPlan.mode === "SHOPIFY_SEARCH"
        ? { mode: "SHOPIFY_SEARCH" as const, query: input.snapshotPlan.query }
        : { mode: "BULKOP" as const, bulkShape: input.snapshotPlan.bulkShape };

    // Deterministic job id prevents duplicates.
    const jobId = `snap:${input.shopId}:${input.snapshotId}`;

    await deps.queues.snapshotScan.add(
      "snapshot.scan",
      {
        shopId: input.shopId,
        shop: input.shop,
        snapshotId: input.snapshotId,
        planHash: input.planHash,
        registryHash: input.registryHash,
        ttlSeconds: ttl,
        snapshotLeaves: input.snapshotLeaves,
        snapshotPlanInfo: planInfo,
      },
      {
        jobId,
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      }
    );

    return { ready: false, status: state.kind === "MISSING" ? ("MISSING" as any) : ((state.status ?? "CREATED") as any) };
  }

  // -----------------------------
  // FAST SQL paging
  // -----------------------------

  function buildFastSql(input: {
    shopId: string;
    fastLeaves: PlanLeaf[];
    after?: string | null; // decimal bigint string
    limit: number;
  }): { sql: string; params: any[] } {
    const compiled = compileFastWhere(input.fastLeaves);

    const params: any[] = [...compiled.params];

    const pShop = `$${params.length + 1}`;
    params.push(input.shopId);

    // REQUIRED BIGINT cursor fix (authoritative)
    let cursorClause = "";
    if (input.after) {
      cursorClause = `AND pl.product_id > ($${params.length + 1})::bigint`;
      params.push(input.after);
    }

    const pLimit = `$${params.length + 1}`;
    params.push(input.limit);

    const sql = `
      SELECT pl.product_id AS "productId"
      FROM product_lite pl
      ${compiled.joinsSql.length ? compiled.joinsSql.join("\n") : ""}
      WHERE (${compiled.whereSql}) AND pl.shop_id = ${pShop}
      ${cursorClause}
      ORDER BY pl.product_id ASC
      LIMIT ${pLimit}
    `.trim();

    return { sql, params };
  }

  async function fetchFastPage(input: {
    shopId: string;
    fastLeaves: PlanLeaf[];
    after?: string | null;
    limit: number;
  }): Promise<{ ids: string[]; endCursor: string | null; hasNextPage: boolean }> {
    const { sql, params } = buildFastSql(input);
    const res = await deps.pg.query(sql, params);

    const ids = res.rows.map((r) => String(r.productId));
    const endCursor = ids.length ? ids[ids.length - 1] : null;
    const hasNextPage = ids.length === input.limit;

    return { ids, endCursor, hasNextPage };
  }

  // -----------------------------
  // Snapshot intersection
  // -----------------------------

  async function smismemberCompat(setKey: string, members: string[]): Promise<boolean[]> {
    if (members.length === 0) return [];
    try {
      const out = (await (deps.redis as any).call("SMISMEMBER", setKey, ...members)) as any[];
      return out.map((x) => String(x) === "1");
    } catch {
      const pipeline = deps.redis.pipeline();
      for (const m of members) pipeline.sismember(setKey, m);
      const res = await pipeline.exec();
      return res.map((pair) => Number(pair?.[1]) === 1);
    }
  }

  async function intersectFastWithSnapshotPaged(input: {
    shopId: string;
    fastLeaves: PlanLeaf[];
    snapshotId: string;
    limit: number;
    after?: string | null;
  }): Promise<{ productIds: string[]; endCursor: string | null; hasNextPage: boolean }> {
    const setKey = snapshot_set_key({ shopId: input.shopId, snapshotId: input.snapshotId });

    const out: string[] = [];
    let scanCursor: string | null = input.after ?? null;
    let lastScannedCursor: string | null = scanCursor;

    const batchSize = Math.max(50, Math.min(500, input.limit * 5));
    const maxBatches = 10;

    let hasNextPage = false;

    for (let batch = 0; batch < maxBatches && out.length < input.limit; batch++) {
      const page = await fetchFastPage({
        shopId: input.shopId,
        fastLeaves: input.fastLeaves,
        after: scanCursor,
        limit: batchSize,
      });

      if (page.ids.length === 0) {
        hasNextPage = false;
        break;
      }

      scanCursor = page.endCursor;
      lastScannedCursor = page.endCursor;

      const flags = await smismemberCompat(setKey, page.ids);
      for (let i = 0; i < page.ids.length && out.length < input.limit; i++) {
        if (flags[i]) out.push(page.ids[i]);
      }

      hasNextPage = page.hasNextPage;
      if (!page.hasNextPage) break;
    }

    return { productIds: out, endCursor: lastScannedCursor, hasNextPage };
  }

  // -----------------------------
  // Public API
  // -----------------------------

  async function queryProducts(input: QueryInput): Promise<QueryResult> {
    const limit = clampInt(input.limit ?? 50, 1, 250, 50);
    const ttlSeconds = clampTtlSeconds(input.ttlSeconds ?? 900, 900);
    const allowEnqueueSnapshot = input.allowEnqueueSnapshot !== false;

    const after = normalizeAfterBigIntCursor(input.after);

    const plan = planFilters(input.filter);
    const snapshotLeaves = plan.snapshot;
    const fastLeaves = plan.fast;

    if (snapshotLeaves.length === 0) {
      const page = await fetchFastPage({ shopId: input.shopId, fastLeaves, after, limit });

      return {
        ok: true,
        mode: "FAST_ONLY",
        productIds: page.ids,
        pageInfo: { hasNextPage: page.hasNextPage, endCursor: page.endCursor },
        meta: { planHash: plan.meta.planHash, registryHash: plan.meta.registryHash },
      };
    }

    const snapshotPlan = evalSnapshotDsl({ snapshotLeaves });
    const snapshotId = plan.meta.planHash;

    const ensure = await ensureSnapshotOrEnqueue({
      shopId: input.shopId,
      shop: input.shop,
      snapshotId,
      planHash: plan.meta.planHash,
      registryHash: plan.meta.registryHash,
      snapshotPlan,
      snapshotLeaves,
      ttlSeconds,
      allowEnqueue: allowEnqueueSnapshot,
    });

    if (!ensure.ready) {
      // Option A: DROP semantics => anything not READY is busy/missing/corrupt => 409
      return {
        ok: false,
        code: "SNAPSHOT_BUSY",
        message: "Snapshot is being built or expired. Retry shortly.",
        snapshotId,
        meta: { planHash: plan.meta.planHash, registryHash: plan.meta.registryHash },
      };
    }

    const page = await intersectFastWithSnapshotPaged({
      shopId: input.shopId,
      fastLeaves,
      snapshotId,
      limit,
      after,
    });

    return {
      ok: true,
      mode: "FAST_PLUS_SNAPSHOT",
      productIds: page.productIds,
      pageInfo: { hasNextPage: page.hasNextPage, endCursor: page.endCursor },
      meta: { planHash: plan.meta.planHash, registryHash: plan.meta.registryHash, snapshotId },
    };
  }

  async function getSnapshotStatus(input: { shopId: string; snapshotId: string }) {
    // Strict state view (same semantics as query path)
    return readSnapshotState({ redis: deps.redis, shopId: input.shopId, snapshotId: input.snapshotId });
  }

  return { queryProducts, getSnapshotStatus };
}
