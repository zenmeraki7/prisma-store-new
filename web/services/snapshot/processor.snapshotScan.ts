// web/services/snapshot/processor.snapshotScan.ts
//
// BullMQ processor factory for snapshot scans (Option A: DROP on TTL expiry).
//
// This is the *canonical* processor used by the BullMQ Worker.
// It recomputes the snapshot plan from snapshotLeaves (deterministic), then builds
// the Redis set of matching productIds (decimal BIGINT strings).
//
// Required hooks (injected):
// - getShopAccessToken({shopId, shop}) -> token
// - runShopifySearch({shop, accessToken, query}) -> productId strings
// - runBulkOpAndEvaluate({shop, accessToken, bulkShape, snapshotLeaves}) -> productId strings
//
// Notes:
// - We align TTL across status/meta/set.
// - We defensively DELETE the set before rebuilding.
// - We mark status RUNNING -> READY, or FAILED with TTL.

import type { Job } from "bullmq";
import type { Redis } from "ioredis";

import type { PlanLeaf } from "../filters/planner";
import { evalSnapshotDsl } from "./eval.snapshot";

import { snapshot_meta_key, snapshot_set_key, snapshot_status_key } from "./snapshot.keys";
import { clampTtlSeconds, markSnapshotFailed, markSnapshotRunning, markSnapshotReady } from "./snapshot.state";

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

export type SnapshotScanProcessorDeps = {
  redis: Redis;

  // STRICT: resolve by shopId (multi-tenant safe). shop is included only for Shopify client targeting.
  getShopAccessToken: (input: { shopId: string; shop: string }) => Promise<string>;

  // Return decimal BIGINT strings only.
  runShopifySearch: (input: { shop: string; accessToken: string; query: string }) => Promise<string[]>;

  // Return decimal BIGINT strings only.
  runBulkOpAndEvaluate: (input: {
    shop: string;
    accessToken: string;
    bulkShape: string;
    snapshotLeaves: PlanLeaf[];
  }) => Promise<string[]>;

  log?: {
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
  };
};

function normalizeIds(xs: string[]): string[] {
  const out: string[] = [];
  for (const x of xs || []) {
    const s = String(x ?? "").trim();
    if (!s) continue;
    if (!/^\d+$/.test(s)) continue; // enforce decimal bigint strings
    out.push(s);
  }
  return Array.from(new Set(out));
}

async function saddChunked(redis: Redis, setKey: string, members: string[], chunkSize = 2000) {
  for (let i = 0; i < members.length; i += chunkSize) {
    const chunk = members.slice(i, i + chunkSize);
    if (chunk.length) await redis.sadd(setKey, ...chunk);
  }
}

export function createSnapshotScanProcessor(deps: SnapshotScanProcessorDeps) {
  const log = deps.log ?? console;

  return async function snapshotScanProcessor(job: Job<SnapshotScanJob>) {
    const data = job.data;

    if (!data?.shopId || !data?.shop || !data?.snapshotId) {
      throw new Error(`snapshot.scan: missing required job fields`);
    }

    const ttl = clampTtlSeconds(data.ttlSeconds, 900);

    const statusKey = snapshot_status_key({ shopId: data.shopId, snapshotId: data.snapshotId });
    const metaKey = snapshot_meta_key({ shopId: data.shopId, snapshotId: data.snapshotId });
    const setKey = snapshot_set_key({ shopId: data.shopId, snapshotId: data.snapshotId });

    // 1) Mark RUNNING + aligned TTL + deterministic meta
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

    // 2) Defensive: delete prior set (rebuild is deterministic)
    await deps.redis.del(setKey);
    await deps.redis.expire(setKey, ttl);

    try {
      // 3) Token
      const accessToken = await deps.getShopAccessToken({ shopId: data.shopId, shop: data.shop });

      // 4) Deterministic plan from leaves
      const snapshotPlan = evalSnapshotDsl({ snapshotLeaves: data.snapshotLeaves });

      // 5) Execute strategy and produce ids
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

      // 6) Materialize set
      if (finalIds.length) {
        await saddChunked(deps.redis, setKey, finalIds, 2000);
      }

      // 7) Align TTLs and mark READY (single pipeline)
      const pipe = deps.redis.pipeline();
      pipe.expire(setKey, ttl);
      pipe.expire(metaKey, ttl);
      pipe.set(statusKey, "READY", "EX", ttl);
      await pipe.exec();

      await markSnapshotReady({ redis: deps.redis, shopId: data.shopId, snapshotId: data.snapshotId, ttlSeconds: ttl });

      log.info(`[snapshot.scan] READY shopId=${data.shopId} snapshotId=${data.snapshotId} count=${finalIds.length} ttl=${ttl}`);
      return { ok: true, count: finalIds.length };
    } catch (e: any) {
      const msg = String(e?.message || e);

      await markSnapshotFailed({
        redis: deps.redis,
        shopId: data.shopId,
        snapshotId: data.snapshotId,
        ttlSeconds: ttl,
        error: msg,
      });

      log.error(`[snapshot.scan] FAILED shopId=${data.shopId} snapshotId=${data.snapshotId} err=${msg}`);
      throw e;
    }
  };
}
