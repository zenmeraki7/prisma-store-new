// web/frontend/hooks/useAuthenticatedFetch.ts

import {
  useAuthenticatedFetch as useShopifyAuthenticatedFetch,
} from "@shopify/app-bridge-react";

/**
 * App Bridge–aware fetch
 *
 * - Automatically injects Authorization: Bearer <session_token>
 * - Handles token refresh internally
 * - BFS-compliant
 *
 * ⚠️ IMPORTANT:
 * This hook is intentionally a thin wrapper.
 * Do NOT add retries, headers, or logic here.
 * All performance and abort logic belongs in higher-level hooks.
 */
export function useAuthenticatedFetch() {
  return useShopifyAuthenticatedFetch();
}
