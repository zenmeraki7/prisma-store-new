// web/services/snapshot/snapshot.keys.ts
//
// Centralized Redis key namespace for Snapshot v1.
//
// Guarantees:
// - Deterministic key derivation by (shopId, snapshotId)
// - Single place to change prefix/version
//
// NOTE:
// Keep this aligned with orchestrator.ts if it uses local key helpers.
// Prefer importing these helpers in orchestrator.ts to avoid drift.

export const SNAPSHOT_PREFIX = "snap:v1";

export function snapshot_status_key(input: { shopId: string; snapshotId: string }) {
  return `${SNAPSHOT_PREFIX}:${input.shopId}:${input.snapshotId}:status`;
}

export function snapshot_meta_key(input: { shopId: string; snapshotId: string }) {
  return `${SNAPSHOT_PREFIX}:${input.shopId}:${input.snapshotId}:meta`;
}

export function snapshot_set_key(input: { shopId: string; snapshotId: string }) {
  return `${SNAPSHOT_PREFIX}:${input.shopId}:${input.snapshotId}:set`;
}
