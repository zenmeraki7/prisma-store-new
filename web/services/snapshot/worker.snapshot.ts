// web/services/snapshot/worker.snapshot.ts
//
// BullMQ Worker factory for snapshot scanning.
//
// This is what your boot file imports:
//   import { createSnapshotWorker } from "../services/snapshot/worker.snapshot";
//
// It wires:
// - BullMQ Worker(queueName="snapshotScan") with the processor
// - injected Redis connection (dedicated for BullMQ worker)
// - concurrency
//
// IMPORTANT:
// - This file does NOT create Redis. Your boot file must pass the connection.
// - This file does NOT assume how to call Shopify. You must inject the hooks.

import { Worker } from "bullmq";
import type { Redis } from "ioredis";

import { createSnapshotScanProcessor, type SnapshotScanJob } from "./processor.snapshotScan";
import type { PlanLeaf } from "../filters/planner";

export type CreateSnapshotWorkerInput = {
  redis: Redis;

  // REQUIRED: multi-tenant safe shopId -> token
  getShopAccessToken: (shopId: string) => Promise<string>;

  // OPTIONAL: override queueName (defaults to "snapshotScan")
  queueName?: string;

  // OPTIONAL: concurrency (defaults 5)
  concurrency?: number;

  // REQUIRED: you must supply at least SHOPIFY_SEARCH executor OR BULKOP executor depending on your registry.
  // If you haven't implemented BulkOp yet, you may throw from runBulkOpAndEvaluate.
  runShopifySearch?: (input: { shop: string; accessToken: string; query: string }) => Promise<string[]>;
  runBulkOpAndEvaluate?: (input: {
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

function must<T>(v: T | undefined | null, msg: string): T {
  if (v === undefined || v === null) throw new Error(msg);
  return v;
}

export function createSnapshotWorker(input: CreateSnapshotWorkerInput) {
  const log = input.log ?? console;

  const queueName = input.queueName ?? process.env.SNAPSHOT_SCAN_QUEUE_NAME ?? "snapshotScan";
  const concurrency = Number.isFinite(Number(input.concurrency)) ? Number(input.concurrency) : Number(process.env.SNAPSHOT_WORKER_CONCURRENCY ?? 5);

  const processor = createSnapshotScanProcessor({
    redis: input.redis,
    getShopAccessToken: async ({ shopId }) => {
      // NOTE: boot contract provides getShopAccessToken(shopId) only.
      const token = await input.getShopAccessToken(shopId);
      if (!token) throw new Error(`snapshot.worker: empty accessToken for shopId=${shopId}`);
      // "shop" is required by Shopify client, but token resolution must be shopId-based.
      return token;
    },
    runShopifySearch: async ({ shop, accessToken, query }) => {
      const fn = must(input.runShopifySearch, "snapshot.worker: runShopifySearch not provided");
      return fn({ shop, accessToken, query });
    },
    runBulkOpAndEvaluate: async ({ shop, accessToken, bulkShape, snapshotLeaves }) => {
      const fn = must(input.runBulkOpAndEvaluate, "snapshot.worker: runBulkOpAndEvaluate not provided");
      return fn({ shop, accessToken, bulkShape, snapshotLeaves });
    },
    log,
  });

  const worker = new Worker<SnapshotScanJob>(queueName, processor as any, {
    connection: input.redis as any,
    concurrency: Math.max(1, Math.min(50, Math.trunc(concurrency || 5))),
  });

  worker.on("ready", () => log.info(`[snapshot.worker] ready queue=${queueName} concurrency=${(worker as any).opts?.concurrency ?? concurrency}`));
  worker.on("error", (err) => log.error(`[snapshot.worker] error`, err));

  return worker;
}
