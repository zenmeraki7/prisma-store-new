// web/controllers/products.query.controller.ts
//
// HTTP controller wrapper for filter orchestrator.
// Keeps external contract stable and prevents drift by delegating logic to orchestrator.ts.
//
// Contract:
// POST /api/products/query
// Body: { filter: FilterNode, limit?: number, after?: string|null, ttlSeconds?: number }
// Response:
// - 200 { ok:true, productIds, pageInfo, meta, mode }
// - 409 { ok:false, code:"SNAPSHOT_BUSY", snapshotId, meta, message }
// - 401 { ok:false, message }
// - 400 { ok:false, message } (invalid body)

import type { Request, Response } from "express";
import { z } from "zod";

import type { FilterNode } from "../services/filters/planner";
import { createFilterOrchestrator } from "../services/filters/orchestrator";

import { pg } from "../db/pg";
import { redis } from "../redis/client";
import { snapshotScanQueue } from "../queue/snapshotScan.queue"; // adjust to your actual queue export

const BodySchema = z
  .object({
    // DSL is validated/normalized inside your filter pipeline. Keep controller thin.
    filter: z.any(),
    limit: z.number().int().min(1).max(250).optional(),
    after: z.string().nullable().optional(),
    ttlSeconds: z.number().int().min(60).max(86400).optional(),
  })
  .strict();

const orchestrator = createFilterOrchestrator({
  pg: { query: (sql, params) => pg.query(sql, params) },
  redis,
  queues: { snapshotScan: snapshotScanQueue },
  log: {
    info: (obj, msg) => console.log(msg ?? "info", obj),
    warn: (obj, msg) => console.warn(msg ?? "warn", obj),
    error: (obj, msg) => console.error(msg ?? "error", obj),
  },
});

export async function productsQueryController(req: Request, res: Response) {
  try {
    const shopId = (req as any).shopId as string | undefined;
    const shop = (req as any).shop as string | undefined;

    if (!shopId || !shop) {
      return res.status(401).json({ ok: false, message: "Missing shop session" });
    }

    const parsed = BodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, message: parsed.error.message });
    }

    const filter = parsed.data.filter as FilterNode;

    const result = await orchestrator.queryProducts({
      shopId,
      shop,
      filter,
      limit: parsed.data.limit,
      after: parsed.data.after ?? null,
      ttlSeconds: parsed.data.ttlSeconds,
      allowEnqueueSnapshot: true,
    });

    if (!result.ok) {
      // SNAPSHOT_BUSY
      return res.status(409).json(result);
    }

    return res.status(200).json(result);
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: String(e?.message || e) });
  }
}
