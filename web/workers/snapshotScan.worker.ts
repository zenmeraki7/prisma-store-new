// web/workers/snapshotScan.worker.ts
//
// BullMQ worker for snapshot building with DROP semantics.
// - Always aligns TTL across status/meta/set.
// - Always deletes any prior set before rebuild (defensive).
// - Writes RUNNING -> READY or FAILED.
// - Stores productIds in Redis set as decimal BIGINT strings.
//
// IMPORTANT:
// - Do NOT trust orchestrator meta alone; worker is the source of truth for set materialization.
// - This file intentionally does not depend on Express or request context.

import type { Job } from "bullmq";
import type { Redis } from "ioredis";

import { snapshot_meta_key, snapshot_set_key, snapshot_status_key } from "../services/snapshot/snapshot.keys";
import {
  clampTtlSeconds,
  markSnapshotFailed,
  markSnapshotReady,
  markSnapshotRunning,
} from "../services/snapshot/snapshot.state";

import { evalSnapshotDsl } from "../services/snapshot/eval.snapshot"; // you already have this
import type { PlanLeaf } from "../services/filters/planner";

// ---- deps you must wire in your worker bootstrap ----
export type SnapshotScanWorkerDeps = {
  redis: Redis;

  // Shopify query executor should be injected; keep it app-specific.
  // It must return product IDs as decimal strings (BIGINT-safe).
  runShopifySearch: (input: { shop: string; accessToken: string; query: string }) => Promise<string[]>;

  // BulkOp executor should be injected; it must stream products and return product IDs that match postFilter.
  runBulkOpAndEvaluate: (input: {
    shop: string;
    accessToken: string;
    bulkShape: string;
    snapshotLeaves: PlanLeaf[];
  }) => Promise<string[]>;

  // Token resolver injected (db access or session storage)
  getAccessToken: (input: { shopId: string; shop: string }) => Promise<string>;

  log?: {
    info: (obj: any, msg?: string) => void;
    warn: (obj: any, msg?: string) => void;
    error: (obj: any, msg?: string) => void;
  };
};

// BullMQ payload (must be serializable)
export type SnapshotScanJob = {
  shopId: string;
  shop: string;
  snapshotId: string;
  planHash: string;
  registryHash: string;
  ttlSeconds: number;

  snapshotLeaves: PlanLeaf[];

  snapshotPlanInfo?: { mode: "SHOPIFY_SEARCH"; query: string } | { mode: "BULKOP"; bulkShape: string };
};

function normalizeIds(xs: string[]): string[] {
  const out: string[] = [];
  for (const x of xs || []) {
    const s = String(x ?? "").trim();
    if (!s) continue;
    if (!/^\d+$/.test(s)) continue; // enforce decimal bigint strings only
    out.push(s);
  }
  // Deduplicate stable
  return Array.from(new Set(out));
}

/**
 * Build processor factory.
 * Your BullMQ worker bootstrap should call:
 *   const processor = createSnapshotScanProcessor(deps);
 *   new Worker("snapshotScan", processor, { connection: ... })
 */
export function createSnapshotScanProcessor(deps: SnapshotScanWorkerDeps) {
  const log =
    deps.log ??
    ({
      info: () => {},
      warn: () => {},
      error: () => {},
    } as any);

  return async function snapshotScanProcessor(job: Job<SnapshotScanJob>) {
    const data = job.data;

    const ttl = clampTtlSeconds(data.ttlSeconds, 900);

    const statusKey = snapshot_status_key({ shopId: data.shopId, snapshotId: data.snapshotId });
    const metaKey = snapshot_meta_key({ shopId: data.shopId, snapshotId: data.snapshotId });
    const setKey = snapshot_set_key({ shopId: data.shopId, snapshotId: data.snapshotId });

    // Initialize as RUNNING + aligned TTL + deterministic meta
    await markSnapshotRunning({
      redis: deps.redis,
      shopId: data.shopId,
      snapshotId: data.snapshotId,
      ttlSeconds: ttl,
      meta: {
        shopId: data.shopId,
        snapshotId: data.snapshotId,
        planHash: data.planHash,
        registryHash: data.registryHash,
        mode: data.snapshotPlanInfo?.mode ?? "UNKNOWN",
        query: (data.snapshotPlanInfo as any)?.query ?? "",
        bulkShape: (data.snapshotPlanInfo as any)?.bulkShape ?? "",
        updatedAt: new Date().toISOString(),
      },
    });

    // Defensive: delete any prior set before rebuilding
    await deps.redis.del(setKey);
    await deps.redis.expire(setKey, ttl);

    try {
      const accessToken = await deps.getAccessToken({ shopId: data.shopId, shop: data.shop });

      // Worker recomputes snapshot plan deterministically from leaves.
      const snapshotPlan = evalSnapshotDsl({ snapshotLeaves: data.snapshotLeaves });

      let ids: string[] = [];

      if (snapshotPlan.mode === "SHOPIFY_SEARCH") {
        ids = await deps.runShopifySearch({ shop: data.shop, accessToken, query: snapshotPlan.query });
      } else {
        ids = await deps.runBulkOpAndEvaluate({
          shop: data.shop,
          accessToken,
          bulkShape: snapshotPlan.bulkShape,
          snapshotLeaves: data.snapshotLeaves,
        });
      }

      const finalIds = normalizeIds(ids);

      if (finalIds.length > 0) {
        // SADD in chunks to avoid large payloads
        const chunkSize = 2000;
        for (let i = 0; i < finalIds.length; i += chunkSize) {
          const chunk = finalIds.slice(i, i + chunkSize);
          await deps.redis.sadd(setKey, ...chunk);
        }
      }

      // Align TTLs (set may have been created after RUNNING status)
      const pipe = deps.redis.pipeline();
      pipe.expire(setKey, ttl);
      pipe.expire(metaKey, ttl);
      pipe.set(statusKey, "READY", "EX", ttl);
      await pipe.exec();

      log.info(
        { shopId: data.shopId, snapshotId: data.snapshotId, count: finalIds.length, ttl },
        "snapshot ready"
      );

      await markSnapshotReady({ redis: deps.redis, shopId: data.shopId, snapshotId: data.snapshotId, ttlSeconds: ttl });
      return { ok: true, count: finalIds.length };
    } catch (e: any) {
      const msg = String(e?.message || e);
      log.error({ shopId: data.shopId, snapshotId: data.snapshotId, err: msg }, "snapshot failed");

      // Mark FAILED with TTL; snapshot will DROP automatically when TTL expires.
      await markSnapshotFailed({
        redis: deps.redis,
        shopId: data.shopId,
        snapshotId: data.snapshotId,
        ttlSeconds: ttl,
        error: msg,
      });

      throw e;
    }
  };
}
