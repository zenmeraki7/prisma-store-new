// web/frontend/src/utils/useAuthFetch.ts
import { useAuthenticatedFetch } from "@shopify/app-bridge-react";

export function useAuthFetch() {
  return useAuthenticatedFetch();
}
