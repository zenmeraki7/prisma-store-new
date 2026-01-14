// web/services/ingest/flushProductFastPlane.ts
//
// Single-source FAST-plane upsert used by:
// - webhooks (products/update)
// - delta sync backfill
// - (later) bulk ingest
//
// Guarantees:
// - BIGINT product_id (stored as bigint in Postgres, passed as decimal string param + ::bigint cast)
// - Idempotent upsert into product_lite + variant_rollups
// - Replace-set tag sync (DELETE then INSERT)
// - Does NOT overwrite created_at on conflict (preserves the first seen created_at)
// - Normalizes empty strings to NULL for indexed columns
//
// Tenant key:
// - shopId must match your DB schema for shop_id (UUID or TEXT).
//   This module does not guess/resolve the tenant key.
//
// Performance notes:
// - Uses a single transaction.
// - Tag insert uses a single multi-row INSERT.
// - Uses numeric strings for min/max prices to avoid float drift in DB.
//

export type FastPlaneProductInput = {
  productId: bigint;

  status: string;
  vendor: string | null;
  productType: string | null;
  handle: string | null;

  createdAt: string | null;
  updatedAt: string; // required for high-water-mark correctness
  publishedAt: string | null;

  tags: string[];
  variants: Array<{ price: any; inventoryQuantity: any }>;
};

type PgPoolLike = {
  connect: () => Promise<{
    query: (sql: string, params?: any[]) => Promise<any>;
    release: () => void;
  }>;
};

export async function flushProductFastPlane(
  deps: { pg: PgPoolLike },
  input: { shopId: string; product: FastPlaneProductInput }
): Promise<void> {
  const client = await deps.pg.connect();

  try {
    await client.query("BEGIN");

    const p = input.product;

    // Normalize nullable indexed columns (empty string -> NULL).
    const vendor = normalizeNullableString(p.vendor);
    const productType = normalizeNullableString(p.productType);
    const handle = normalizeNullableString(p.handle);

    // A) Upsert product_lite
    // Preserve created_at on conflict (do not overwrite).
    await client.query(
      `
      INSERT INTO product_lite
        (shop_id, product_id, status, vendor, product_type, handle, created_at, updated_at, published_at)
      VALUES
        ($1, $2::bigint, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz, $9::timestamptz)
      ON CONFLICT (shop_id, product_id) DO UPDATE SET
        status = EXCLUDED.status,
        vendor = EXCLUDED.vendor,
        product_type = EXCLUDED.product_type,
        handle = EXCLUDED.handle,
        updated_at = EXCLUDED.updated_at,
        published_at = EXCLUDED.published_at
    `.trim(),
      [
        input.shopId,
        p.productId.toString(10),
        normalizeStatus(p.status),
        vendor,
        productType,
        handle,
        p.createdAt, // can be null
        p.updatedAt,
        p.publishedAt,
      ]
    );

    // B) Rollups
    const roll = computeRollups(p.variants);

    await client.query(
      `
      INSERT INTO variant_rollups
        (shop_id, product_id, variant_count, total_inventory, min_price, max_price, in_stock)
      VALUES
        ($1, $2::bigint, $3, $4, $5::numeric, $6::numeric, $7)
      ON CONFLICT (shop_id, product_id) DO UPDATE SET
        variant_count = EXCLUDED.variant_count,
        total_inventory = EXCLUDED.total_inventory,
        min_price = EXCLUDED.min_price,
        max_price = EXCLUDED.max_price,
        in_stock = EXCLUDED.in_stock
    `.trim(),
      [
        input.shopId,
        p.productId.toString(10),
        roll.variant_count,
        roll.total_inventory,
        roll.min_price,
        roll.max_price,
        roll.in_stock,
      ]
    );

    // C) Replace-set tag sync
    await client.query(`DELETE FROM product_tag WHERE shop_id = $1 AND product_id = $2::bigint`, [
      input.shopId,
      p.productId.toString(10),
    ]);

    const tags = normalizeTags(p.tags);

    if (tags.length > 0) {
      const values: any[] = [];
      const rows: string[] = [];

      for (const tag of tags) {
        // ($1, $2::bigint, $3), ($4, $5::bigint, $6), ...
        rows.push(`($${values.length + 1}, $${values.length + 2}::bigint, $${values.length + 3})`);
        values.push(input.shopId, p.productId.toString(10), tag);
      }

      await client.query(
        `
        INSERT INTO product_tag (shop_id, product_id, tag)
        VALUES ${rows.join(",\n")}
        ON CONFLICT (shop_id, product_id, tag) DO NOTHING
      `.trim(),
        values
      );
    }

    await client.query("COMMIT");
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback failure
    }
    throw e;
  } finally {
    client.release();
  }
}

// -----------------------------
// Helpers
// -----------------------------

function normalizeStatus(s: any): string {
  const v = String(s ?? "").trim().toUpperCase();
  return v || "UNKNOWN";
}

function normalizeNullableString(v: any): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function normalizeTags(tags: any): string[] {
  if (!Array.isArray(tags)) return [];
  const out: string[] = [];
  for (const t of tags) {
    const s = String(t ?? "").trim();
    if (s) out.push(s);
  }
  // Deduplicate (stable)
  return Array.from(new Set(out));
}

function computeRollups(variants: Array<{ price: any; inventoryQuantity: any }>) {
  const xs = Array.isArray(variants) ? variants : [];
  const variant_count = xs.length;

  let total_inventory = 0;
  let in_stock = false;

  // Keep numeric comparisons in JS, but write to DB as decimal strings.
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const v of xs) {
    const inv = coerceInt(v?.inventoryQuantity);
    total_inventory += inv;
    if (inv > 0) in_stock = true;

    const price = coerceMoney(v?.price);
    if (price !== null) {
      if (price < min) min = price;
      if (price > max) max = price;
    }
  }

  if (!Number.isFinite(min)) min = 0;
  if (!Number.isFinite(max)) max = 0;

  return {
    variant_count,
    total_inventory,
    min_price: formatMoney(min),
    max_price: formatMoney(max),
    in_stock,
  };
}

function coerceInt(v: any): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(String(v));
  if (!Number.isFinite(n)) return 0;
  // Inventory can be negative in some workflows; keep it deterministic as int.
  return Math.trunc(n);
}

function coerceMoney(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

function formatMoney(n: number): string {
  // Force 2dp stable string for ::numeric ingestion.
  // Avoid locale formatting.
  return n.toFixed(2);
}
