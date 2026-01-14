// web/services/sync/deltaSync.service.ts
//
// Delta Sync service (cursor-based) to backfill missed updates during downtime.
// Fetches products where updatedAt > highWaterMark (with overlap) and applies
// the same deterministic FAST-plane upsert logic used by webhooks.
//
// Guarantees:
// - BIGINT internal product_id (parse Shopify GID -> BIGINT)
// - Idempotent upserts into product_lite + variant_rollups
// - Replace-set tag sync
// - Cursor-based pagination
// - Overlap window (default 60s) to avoid missing edge updates
// - Reuses shared FAST-plane ingest (single source of truth)
//
// Tenant key:
// - Accepts both shopId and shop; prefer internal UUID shopId.
// - If you still use shop domain as tenant key, pass shopId=shop.
//
// ESM TypeScript.

import { pg } from "../db.server"; // adjust to your pool module
import { createShopifyClient } from "../../shopify/graphqlClient"; // align with your web/shopify/graphql.ts
import { flushProductFastPlane } from "../ingest/flushProductFastPlane";

type DeltaSyncInput = {
  shopId: string;
  shop: string;

  overlapSeconds?: number; // default 60
  pageSize?: number; // default 50 (max 250)
  variantsFirst?: number; // default 100
  maxProducts?: number; // default 50_000
};

type NormalizedProduct = {
  productId: bigint;
  status: string;
  vendor: string | null;
  productType: string | null;
  handle: string | null;
  createdAt: string | null;
  updatedAt: string;
  publishedAt: string | null;
  tags: string[];
  variants: Array<{ price: string | null; inventoryQuantity: number | null }>;
};

export class DeltaSyncService {
  private readonly shop: string;
  private readonly shopId: string;

  private readonly overlapSeconds: number;
  private readonly pageSize: number;
  private readonly variantsFirst: number;
  private readonly maxProducts: number;

  constructor(input: DeltaSyncInput) {
    if (!input.shopId || !input.shop) throw new Error("DeltaSyncService: missing shopId/shop");
    this.shopId = input.shopId;
    this.shop = input.shop;

    this.overlapSeconds = clampInt(input.overlapSeconds, 0, 600, 60);
    this.pageSize = clampInt(input.pageSize, 1, 250, 50);
    this.variantsFirst = clampInt(input.variantsFirst, 0, 250, 100);
    this.maxProducts = clampInt(input.maxProducts, 1, 1_000_000, 50_000);
  }

  async run(): Promise<{ ok: true; scanned: number; applied: number; since: string }> {
    const lastSyncIso = await this.getHighWaterMarkIso();
    const sinceIso = new Date(Date.parse(lastSyncIso) - this.overlapSeconds * 1000).toISOString();

    console.log(
      `[DeltaSync] shop=${this.shop} shopId=${this.shopId} since=${sinceIso} overlap=${this.overlapSeconds}s pageSize=${this.pageSize}`
    );

    const token = await getAccessTokenForShop(this.shopId, this.shop);

    // Align with your web/shopify/graphql.ts signature:
    // createShopifyClient({ shop, accessToken, graphql })
    const client = createShopifyClient({ shop: this.shop, accessToken: token });

    let cursor: string | null = null;
    let hasNextPage = true;

    let scanned = 0;
    let applied = 0;

    while (hasNextPage) {
      if (scanned >= this.maxProducts) {
        console.warn(
          `[DeltaSync] maxProducts reached; stopping early shop=${this.shop} scanned=${scanned} max=${this.maxProducts}`
        );
        break;
      }

      const query = buildUpdatedAtQuery(sinceIso);

      // NOTE: Keep query shape minimal + deterministic.
      // If you later need collections/metafields, do that in BulkOps ingest, not DeltaSync.
      const resp = await client.graphql<any>({
        query: `
          query DeltaSync($query: String!, $cursor: String, $first: Int!, $variantsFirst: Int!) {
            products(first: $first, query: $query, after: $cursor) {
              pageInfo { hasNextPage }
              edges {
                cursor
                node {
                  id
                  status
                  vendor
                  productType
                  handle
                  createdAt
                  updatedAt
                  publishedAt
                  tags
                  variants(first: $variantsFirst) {
                    edges {
                      node {
                        id
                        price
                        inventoryQuantity
                      }
                    }
                  }
                }
              }
            }
          }
        `.trim(),
        variables: { query, cursor, first: this.pageSize, variantsFirst: this.variantsFirst },
      });

      // Your client.graphql wrapper returns the GraphQL JSON directly; accept both shapes safely.
      const products = resp?.products ?? resp?.data?.products;
      const edges = products?.edges ?? [];
      hasNextPage = Boolean(products?.pageInfo?.hasNextPage);

      if (!Array.isArray(edges) || edges.length === 0) break;

      for (const edge of edges) {
        if (scanned >= this.maxProducts) break;

        const node = edge?.node;
        if (!node?.id) continue;

        scanned++;

        const normalized = normalizeGraphqlProduct(node);

        await flushProductFastPlane(
          { pg },
          {
            shopId: this.shopId,
            product: normalized,
          }
        );

        applied++;
      }

      cursor = edges[edges.length - 1]?.cursor ?? null;
      if (!cursor) break;
    }

    console.log(`[DeltaSync] done shop=${this.shop} scanned=${scanned} applied=${applied} since=${sinceIso}`);
    return { ok: true, scanned, applied, since: sinceIso };
  }

  private async getHighWaterMarkIso(): Promise<string> {
    const r = await pg.query(
      `SELECT MAX(updated_at) as "lastSync"
       FROM product_lite
       WHERE shop_id = $1`,
      [this.shopId]
    );

    const last = r.rows?.[0]?.lastSync ? new Date(r.rows[0].lastSync) : null;

    // Fallback: 24 hours ago if table empty
    if (!last || Number.isNaN(last.getTime())) return new Date(Date.now() - 86_400_000).toISOString();

    return last.toISOString();
  }
}

// -----------------------------
// Normalization helpers
// -----------------------------

function normalizeGraphqlProduct(node: any): NormalizedProduct {
  const productId = parseGidToBigint(node.id);

  const tags: string[] = Array.isArray(node.tags) ? node.tags.map(normalizeTag).filter(Boolean) : [];

  const variantsEdges = node?.variants?.edges ?? [];
  const variants = Array.isArray(variantsEdges)
    ? variantsEdges
        .map((e: any) => e?.node)
        .filter((v: any) => v && v.id)
        .map((v: any) => ({
          price: v.price != null ? String(v.price) : null,
          inventoryQuantity: v.inventoryQuantity != null ? Number(v.inventoryQuantity) : null,
        }))
    : [];

  const updatedAt = node.updatedAt ? String(node.updatedAt) : new Date().toISOString();

  return {
    productId,
    status: normalizeStatus(node.status),
    vendor: normalizeNullableString(node.vendor),
    productType: normalizeNullableString(node.productType),
    handle: normalizeNullableString(node.handle),
    createdAt: node.createdAt ? String(node.createdAt) : null,
    updatedAt,
    publishedAt: node.publishedAt ? String(node.publishedAt) : null,
    tags,
    variants,
  };
}

function normalizeStatus(v: any): string {
  // Shopify often returns enum-like strings already, but keep deterministic.
  const s = String(v ?? "").trim().toUpperCase();
  return s || "DRAFT";
}

function normalizeTag(v: any): string {
  // Keep case as-is (Shopify tags are case-sensitive-ish in practice).
  // Trim + drop empties.
  return String(v ?? "").trim();
}

function normalizeNullableString(v: any): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function buildUpdatedAtQuery(sinceIso: string): string {
  // Shopify search syntax: updated_at:>'YYYY-MM-DDTHH:MM:SSZ'
  // Ensure ISO is quoted to avoid syntax ambiguity.
  return `updated_at:>'${sinceIso}'`;
}

function parseGidToBigint(gid: string): bigint {
  const s = String(gid || "");
  const m = s.match(/^gid:\/\/shopify\/[A-Za-z]+\/(\d+)$/);
  if (!m) throw new Error(`Invalid Shopify GID: ${gid}`);
  return BigInt(m[1]);
}

// -----------------------------
// Access token lookup
// -----------------------------

async function getAccessTokenForShop(shopId: string, shop: string): Promise<string> {
  // Prefer shops table by internal UUID.
  try {
    const r = await pg.query(`SELECT access_token FROM shops WHERE id = $1 LIMIT 1`, [shopId]);
    const t = r.rows?.[0]?.access_token;
    if (t) return String(t);
  } catch {
    // ignore
  }

  // Fallback: shops by domain
  try {
    const r = await pg.query(`SELECT access_token FROM shops WHERE shop = $1 LIMIT 1`, [shop]);
    const t = r.rows?.[0]?.access_token;
    if (t) return String(t);
  } catch {
    // ignore
  }

  // Session fallback (if you use Prisma session storage, adapt column names accordingly)
  try {
    const r = await pg.query(
      `SELECT access_token FROM sessions WHERE shop = $1 ORDER BY updated_at DESC NULLS LAST LIMIT 1`,
      [shop]
    );
    const t = r.rows?.[0]?.access_token;
    if (t) return String(t);
  } catch {
    // ignore
  }

  throw new Error(`DeltaSync: cannot find access token for shopId=${shopId} shop=${shop}`);
}

function clampInt(n: any, lo: number, hi: number, dflt: number) {
  const v = Number(n ?? dflt);
  if (!Number.isFinite(v)) return dflt;
  return Math.max(lo, Math.min(hi, Math.floor(v)));
}
