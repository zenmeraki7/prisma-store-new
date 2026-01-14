// web/services/snapshot/snapshot.state.ts
//
// Snapshot state machine helpers (Redis).
//
// Implements Option A eviction semantics:
// - On TTL expiry, keys disappear => orchestrator must enqueue rebuild and return SNAPSHOT_BUSY.
// - No re-eval on expiry; we "DROP" and rebuild on-demand.
//
// Guarantees:
// - Status transitions are explicit and TTL-aligned across status/meta/set.
// - Status values are stable strings: CREATED | RUNNING | READY | FAILED.
// - Meta is a hash for lightweight observability/debug (planHash, registryHash, etc.)
//
// IMPORTANT:
// These helpers do NOT assume your snapshotId generation scheme.
// snapshotId is passed in, deterministic for the request (e.g. planHash).

import type { Redis } from "ioredis";
import { snapshot_meta_key, snapshot_set_key, snapshot_status_key } from "./snapshot.keys";

export type SnapshotStatus = "CREATED" | "RUNNING" | "READY" | "FAILED";

export function clampTtlSeconds(ttlSeconds: any, fallback = 900): number {
  const n = Number(ttlSeconds);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  // hard bounds
  if (i < 60) return 60;
  if (i > 86400) return 86400;
  return i;
}

export async function getSnapshotStatusView(input: { redis: Redis; shopId: string; snapshotId: string }) {
  const statusKey = snapshot_status_key({ shopId: input.shopId, snapshotId: input.snapshotId });
  const metaKey = snapshot_meta_key({ shopId: input.shopId, snapshotId: input.snapshotId });
  const setKey = snapshot_set_key({ shopId: input.shopId, snapshotId: input.snapshotId });

  const [statusRaw, meta, ttlMeta, ttlSet, card] = await Promise.all([
    input.redis.get(statusKey),
    input.redis.hgetall(metaKey),
    input.redis.ttl(metaKey),
    input.redis.ttl(setKey),
    input.redis.scard(setKey),
  ]);

  const status = ((statusRaw ?? "CREATED") as SnapshotStatus) ?? "CREATED";

  const ttlSecondsRemaining = ttlMeta >= 0 ? ttlMeta : ttlSet >= 0 ? ttlSet : null;

  return {
    snapshotId: input.snapshotId,
    status,
    ttlSecondsRemaining,
    cardinality: Number(card ?? 0),
    meta: meta ?? {},
  };
}

export async function markSnapshotRunning(input: {
  redis: Redis;
  shopId: string;
  snapshotId: string;
  ttlSeconds: number;
  meta: Record<string, string>;
}) {
  const ttl = clampTtlSeconds(input.ttlSeconds);
  const statusKey = snapshot_status_key({ shopId: input.shopId, snapshotId: input.snapshotId });
  const metaKey = snapshot_meta_key({ shopId: input.shopId, snapshotId: input.snapshotId });
  const setKey = snapshot_set_key({ shopId: input.shopId, snapshotId: input.snapshotId });

  const pipe = input.redis.pipeline();

  // Status + TTL
  pipe.set(statusKey, "RUNNING", "EX", ttl);

  // Meta hash + TTL
  pipe.hset(metaKey, input.meta);
  pipe.expire(metaKey, ttl);

  // Ensure set TTL exists even before materialization
  pipe.expire(setKey, ttl);

  await pipe.exec();
}

export async function markSnapshotReady(input: { redis: Redis; shopId: string; snapshotId: string; ttlSeconds: number }) {
  const ttl = clampTtlSeconds(input.ttlSeconds);
  const statusKey = snapshot_status_key({ shopId: input.shopId, snapshotId: input.snapshotId });
  await input.redis.set(statusKey, "READY", "EX", ttl);
}

export async function markSnapshotFailed(input: {
  redis: Redis;
  shopId: string;
  snapshotId: string;
  ttlSeconds: number;
  error: string;
}) {
  const ttl = clampTtlSeconds(input.ttlSeconds);
  const statusKey = snapshot_status_key({ shopId: input.shopId, snapshotId: input.snapshotId });
  const metaKey = snapshot_meta_key({ shopId: input.shopId, snapshotId: input.snapshotId });
  const setKey = snapshot_set_key({ shopId: input.shopId, snapshotId: input.snapshotId });

  const pipe = input.redis.pipeline();

  pipe.set(statusKey, "FAILED", "EX", ttl);

  // Keep last error in meta for debugging; TTL aligns.
  pipe.hset(metaKey, {
    status: "FAILED",
    error: String(input.error ?? "unknown error"),
    failedAt: new Date().toISOString(),
  });
  pipe.expire(metaKey, ttl);

  // Ensure the set cannot outlive status/meta.
  pipe.expire(setKey, ttl);

  await pipe.exec();
}

/**
 * Option A helper: treat missing/expired snapshots as "dropped".
 * If any key is missing (meta/status/set), callers should enqueue rebuild.
 */
export async function isSnapshotReadyStrict(input: { redis: Redis; shopId: string; snapshotId: string }): Promise<boolean> {
  const statusKey = snapshot_status_key({ shopId: input.shopId, snapshotId: input.snapshotId });
  const metaKey = snapshot_meta_key({ shopId: input.shopId, snapshotId: input.snapshotId });
  const setKey = snapshot_set_key({ shopId: input.shopId, snapshotId: input.snapshotId });

  const [status, metaExists, setExists] = await Promise.all([
    input.redis.get(statusKey),
    input.redis.exists(metaKey),
    input.redis.exists(setKey),
  ]);

  if (String(status ?? "").toUpperCase() !== "READY") return false;
  if (Number(metaExists) !== 1) return false;
  if (Number(setExists) !== 1) return false;

  return true;
}
