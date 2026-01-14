// web/queue/snapshotScan.queue.ts
//
// BullMQ queue definition for SNAPSHOT scan/build jobs.
//
// Guarantees:
// - Single authoritative queue name (no drift across producer/worker)
// - Default job options tuned for long-running snapshot builds
// - Uses the shared BullMQ connection from queues.instance.ts
//
// Used by:
// - web/services/filters/orchestrator.ts (enqueue snapshot build)
// - web/services/snapshot/worker.snapshot.ts (worker consumes)
//
// ESM TypeScript.

import { Queue } from "bullmq";
import { bullmqConnection, defaultJobOptions } from "./queues.instance";

export const SNAPSHOT_SCAN_QUEUE_NAME = "snapshot.scan.v1";

/**
 * Producer queue (enqueue snapshot scan/build).
 */
export const snapshotScanQueue = new Queue(SNAPSHOT_SCAN_QUEUE_NAME, {
  connection: bullmqConnection,
  defaultJobOptions: {
    ...defaultJobOptions,
    // Snapshot jobs can be heavy; keep a bit more history for debugging.
    removeOnComplete: 2000,
    removeOnFail: 10000,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  },
});
