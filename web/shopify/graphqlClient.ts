// web/shopify/graphqlClient.ts
//
// Shopify GraphQL client (Admin API) with:
// - Stable signature: graphqlClient(shop, accessToken) -> { query<T>(query, variables?) }
// - Token-bucket rate limiting (client-side)
// - Retry on transient failures + GraphQL THROTTLED
// - Safe JSON parsing + clear error surfaces
//
// This is designed to be used by:
// - DeltaSyncService (cursor paging)
// - Snapshot worker (runShopifySearch / BulkOp kickoffs)
//
// ESM TypeScript. Node 18+ (global fetch).

export const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || "2025-07";

export type ShopifyGraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string; extensions?: any }>;
  extensions?: any;
};

export type ShopifyGraphqlClient = {
  shop: string;
  accessToken: string;
  query: <T = any>(query: string, variables?: Record<string, any>) => Promise<T>;
};

// -----------------------------
// Rate limiting (token bucket)
// -----------------------------

class TokenBucket {
  private tokens: number;
  private lastMs: number;

  constructor(private readonly ratePerSec: number, private readonly burst: number) {
    this.tokens = burst;
    this.lastMs = Date.now();
  }

  async take(n: number) {
    // n ~ "cost units" (roughly). For most queries, you can treat n=1.
    while (true) {
      const now = Date.now();
      const elapsed = (now - this.lastMs) / 1000;
      if (elapsed > 0) {
        this.tokens = Math.min(this.burst, this.tokens + elapsed * this.ratePerSec);
        this.lastMs = now;
      }
      if (this.tokens >= n) {
        this.tokens -= n;
        return;
      }
      await sleep(50);
    }
  }
}

const defaultBucket = new TokenBucket(
  Number(process.env.SHOPIFY_GQL_RATE_PER_SEC ?? 20),
  Number(process.env.SHOPIFY_GQL_BURST ?? 40)
);

// -----------------------------
// Public factory
// -----------------------------

export async function graphqlClient(shop: string, accessToken: string): Promise<ShopifyGraphqlClient> {
  if (!shop) throw new Error("graphqlClient: missing shop");
  if (!accessToken) throw new Error("graphqlClient: missing accessToken");

  const adminUrl = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  return {
    shop,
    accessToken,

    async query<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
      const q = String(query ?? "").trim();
      if (!q) throw new Error("graphqlClient.query: missing query");

      // Client-side pacing (helps prevent bursts, not a substitute for Shopify throttling logic).
      await defaultBucket.take(1);

      const payload = { query: q, variables: variables ?? {} };

      const maxAttempts = clampInt(process.env.SHOPIFY_GQL_MAX_ATTEMPTS, 1, 10, 5);

      let lastErr: any = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const res = await fetch(adminUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": accessToken,
              // Useful for Shopify logs/support and your own tracing.
              "User-Agent": `zen-meraki/graphClient; node=${process.version}; api=${SHOPIFY_API_VERSION}`,
            },
            body: JSON.stringify(payload),
          });

          const text = await res.text();

          if (!res.ok) {
            // Retry on 429/5xx
            if (isRetryableHttp(res.status) && attempt < maxAttempts) {
              await backoff(attempt, res.headers.get("retry-after"));
              continue;
            }
            throw new Error(`Shopify HTTP ${res.status} ${res.statusText}: ${truncate(text, 500)}`);
          }

          let parsed: ShopifyGraphqlResponse<T>;
          try {
            parsed = JSON.parse(text);
          } catch {
            throw new Error(`Shopify GraphQL: invalid JSON response: ${truncate(text, 500)}`);
          }

          // GraphQL-level errors (may still be retryable if throttled).
          if (Array.isArray(parsed.errors) && parsed.errors.length) {
            const throttled = parsed.errors.some((e) => isThrottledGraphqlError(e));
            if (throttled && attempt < maxAttempts) {
              await backoff(attempt, null);
              continue;
            }
            throw new Error(`Shopify GraphQL errors: ${parsed.errors.map((e) => e.message).join(" | ")}`);
          }

          // Shopify sometimes returns { data: null, errors: [...] } already handled above.
          if (!("data" in parsed)) {
            throw new Error(`Shopify GraphQL: missing data field: ${truncate(text, 500)}`);
          }

          return parsed.data as T;
        } catch (e: any) {
          lastErr = e;

          // Retry on network failures
          const retryable = isRetryableNetworkError(e);
          if (retryable && attempt < maxAttempts) {
            await backoff(attempt, null);
            continue;
          }

          break;
        }
      }

      throw new Error(`Shopify GraphQL request failed: ${String(lastErr?.message || lastErr)}`);
    },
  };
}

// -----------------------------
// Helpers
// -----------------------------

export function parseShopifyGidToBigintString(gid: string, ctx?: { label?: string }): string {
  const s = String(gid || "");
  const m = s.match(/^gid:\/\/shopify\/[A-Za-z]+\/(\d+)$/);
  if (!m) {
    throw new Error(`Invalid Shopify GID${ctx?.label ? ` (${ctx.label})` : ""}: ${s}`);
  }
  // Return decimal string (BIGINT-safe, no JS number precision loss)
  return m[1];
}

function isRetryableHttp(status: number): boolean {
  // 429 Too Many Requests, 5xx server errors
  return status === 429 || (status >= 500 && status <= 599);
}

function isThrottledGraphqlError(e: { message: string; extensions?: any }): boolean {
  const msg = String(e?.message ?? "");
  const code = e?.extensions?.code;

  // Shopify commonly uses "THROTTLED" in extensions.code, but message checks help too.
  if (String(code || "").toUpperCase() === "THROTTLED") return true;
  if (/throttl/i.test(msg)) return true;

  return false;
}

function isRetryableNetworkError(e: any): boolean {
  // fetch throws TypeError on network failures; node may also throw ECONNRESET, ETIMEDOUT, etc.
  const msg = String(e?.message ?? "");
  if (e?.name === "TypeError") return true;
  if (/ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up/i.test(msg)) return true;
  return false;
}

async function backoff(attempt: number, retryAfterHeader: string | null) {
  // Honor Retry-After if provided (seconds). Otherwise exponential + jitter.
  const ra = retryAfterHeader ? Number(retryAfterHeader) : NaN;
  if (Number.isFinite(ra) && ra > 0) {
    await sleep(Math.min(ra, 30) * 1000);
    return;
  }

  const base = 250;
  const cap = 8000;
  const exp = Math.min(cap, base * Math.pow(2, attempt - 1));
  const jitter = Math.floor(Math.random() * 250);
  await sleep(exp + jitter);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function truncate(s: string, max: number) {
  const str = String(s ?? "");
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

function clampInt(n: any, lo: number, hi: number, dflt: number) {
  const v = Number(n ?? dflt);
  if (!Number.isFinite(v)) return dflt;
  return Math.max(lo, Math.min(hi, Math.trunc(v)));
}
