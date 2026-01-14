// web/services/db.server.ts
//
// Postgres connection bootstrap for the FAST plane and orchestrator.
// Single, shared pg Pool with safe defaults.
//
// Guarantees:
// - BIGINTs are returned as strings (no precision loss)
// - Connection pooling with sane limits
// - ESM-compatible
//
// Used by:
// - FAST compiler/orchestrator
// - Ingest (flushProductFastPlane)
// - Snapshot orchestration metadata
//
// IMPORTANT:
// - Do NOT parse int8 into JS number
// - Cursor paging relies on BIGINT-as-string behavior

import pg from "pg";

const { Pool, types } = pg;

// -----------------------------
// BIGINT safety
// -----------------------------
// Force int8 / numeric to string to avoid precision loss.
types.setTypeParser(20, (v) => v); // int8
types.setTypeParser(1700, (v) => v); // numeric

// -----------------------------
// Pool configuration
// -----------------------------

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export const pool = new Pool({
  connectionString: DATABASE_URL,

  // Tune conservatively; scale up via env if needed
  max: Number(process.env.PG_POOL_MAX ?? 10),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30_000),
  connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT_MS ?? 10_000),

  ssl:
    process.env.PG_SSL === "true" || DATABASE_URL.includes("supabase")
      ? { rejectUnauthorized: false }
      : undefined,
});

// -----------------------------
// Public API
// -----------------------------

export const pgDb = {
  /**
   * Low-level query helper.
   * Always returns rows with BIGINT fields as strings.
   */
  query: (text: string, params?: any[]) => pool.query(text, params),

  /**
   * Transactional client access.
   * Caller MUST release().
   */
  connect: () => pool.connect(),
};

// Graceful shutdown hook (optional)
export async function closeDbPool() {
  await pool.end();
}
