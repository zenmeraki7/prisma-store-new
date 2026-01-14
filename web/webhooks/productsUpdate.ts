// web/backend/webhooks/productsUpdate.ts
//
// Webhook handler: products/update
//
// Guarantees:
// - BIGINT internal IDs (product_id)
// - Upserts product_lite + variant_rollups
// - Replace-set semantics for product_tag
// - product_collection NOT updated here (not present in REST payload)
//
// IMPORTANT:
// - Delegates to shared FAST-plane ingest: flushProductFastPlane()
// - Does NOT overwrite created_at on conflict
//
// Tenant key:
// - shopId must match your DB schema (UUID or TEXT). If you use UUID tenancy,
//   resolve shop domain -> shops.id before calling flushProductFastPlane().

import { pg } from "../../services/db.server"; // adjust if your pool lives elsewhere
import { flushProductFastPlane } from "../services/ingest/flushProductFastPlane";

type ProductsUpdateWebhookPayload = {
  id: number | string;
  status?: string | null;
  vendor?: string | null;
  product_type?: string | null;
  handle?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  published_at?: string | null;
  tags?: string | string[] | null;
  variants?: Array<{
    price?: string | number | null;
    inventory_quantity?: number | string | null;
  }> | null;
};

export async function productsUpdateHandler(topic: string, shop: string, body: string) {
  const payload = JSON.parse(body) as ProductsUpdateWebhookPayload;

  // If your DB uses UUID tenant ids, replace this with a resolver:
  // const shopId = await resolveShopUuid(shop);
  const shopId = shop; // tenant key (TEXT shop domain) OR resolved UUID

  const numericProductId = parseRestIdToBigint(payload.id, { field: "payload.id" });

  const normalized = {
    productId: numericProductId,
    status: normalizeStatus(payload.status),
    vendor: normalizeNullableString(payload.vendor),
    productType: normalizeNullableString(payload.product_type),
    handle: normalizeNullableString(payload.handle),
    createdAt: payload.created_at ? String(payload.created_at) : null,
    updatedAt: payload.updated_at ? String(payload.updated_at) : new Date().toISOString(),
    publishedAt: payload.published_at ? String(payload.published_at) : null,
    tags: normalizeTagsFromRest(payload.tags),
    variants: Array.isArray(payload.variants)
      ? payload.variants.map((v) => ({
          price: v?.price != null ? String(v.price) : null,
          inventoryQuantity: v?.inventory_quantity != null ? Number(v.inventory_quantity) : null,
        }))
      : [],
  };

  console.log(`[Webhook] ${topic} shop=${shop} product=${numericProductId.toString(10)}`);

  await flushProductFastPlane(
    { pg },
    {
      shopId,
      product: normalized,
    }
  );
}

function parseRestIdToBigint(id: any, ctx: { field: string }): bigint {
  // REST product.id is numeric (string or number). Fail fast if not.
  const s = String(id ?? "").trim();
  if (!/^\d+$/.test(s)) throw new Error(`products/update: invalid numeric id for ${ctx.field}: ${s}`);
  return BigInt(s);
}

function normalizeStatus(v: any): string {
  // Shopify REST can return lower/upper depending on version; normalize to upper.
  const s = String(v ?? "").trim().toUpperCase();
  // Keep deterministic fallback.
  return s || "DRAFT";
}

function normalizeNullableString(v: any): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function normalizeTagsFromRest(tagsRaw: any): string[] {
  if (!tagsRaw) return [];
  if (Array.isArray(tagsRaw)) return tagsRaw.map((t) => String(t).trim()).filter(Boolean);
  if (typeof tagsRaw === "string") {
    return tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}
