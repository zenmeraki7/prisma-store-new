// web/frontend/hooks/useProductsInfinite.ts

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAuthenticatedFetch } from "./useAuthenticatedFetch";
import {
  useProductStore,
  useProductPagination,
} from "../stores/productStore";
import { useFilterGroups } from "../stores/filterStore";
import { FilterSerializer } from "../utils/FilterSerializer";
import {ProductsResponse}  from "../types/product";

/* ------------------------------------------------------------------ */
/* API CLIENT */
/* ------------------------------------------------------------------ */

async function fetchProductsAPI(
  fetchFn: (
    input: RequestInfo,
    init?: RequestInit
  ) => Promise<Response>,
  params: {
    limit: number;
    cursor?: string | null;
    query?: string;
    filters?: any[];
  },
  signal: AbortSignal
): Promise<ProductsResponse> {
  const response = await fetchFn("/api/products/search", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      limit: params.limit,
      cursor: params.cursor,
      query: params.query,
      filters: params.filters,
    }),
  });

  if (!response.ok) {
    // ⚠️ BUG FIX: string interpolation
    let message = `HTTP ${response.status}`;

    try {
      const body = await response.json();
      message = body?.error || message;
    } catch {
      /* noop */
    }

    throw new Error(message);
  }

  return response.json();
}

/* ------------------------------------------------------------------ */
/* HOOK */
/* ------------------------------------------------------------------ */

export function useProductsInfinite() {
  const fetch = useAuthenticatedFetch();

  /* ---------------- Zustand Selectors ---------------- */

  const upsertMany = useProductStore((s) => s.upsertMany);
  const setPageInfo = useProductStore((s) => s.setPageInfo);
  const setLoading = useProductStore((s) => s.setLoading);
  const setFetchingNext = useProductStore((s) => s.setFetchingNext);
  const reset = useProductStore((s) => s.reset);

  const { hasNextPage, endCursor } = useProductPagination();

  /* ---------------- Filters ---------------- */

  const filterGroups = useFilterGroups();

  /**
   * 🧠 Compile AST → Shopify Search Syntax
   * This is memoized and becomes the *identity* of the query.
   */
  const queryString = useMemo(() => {
    return FilterSerializer.serialize(filterGroups);
  }, [filterGroups]);

  /* ---------------- Refs (Concurrency Control) ---------------- */

  const abortRef = useRef<AbortController | null>(null);
  const loadingRef = useRef(false);
  const prevQueryRef = useRef<string>(queryString);

  /* ------------------------------------------------------------------ */
  /* LOAD INITIAL (RESET + FETCH) */
  /* ------------------------------------------------------------------ */

  const loadInitial = useCallback(async () => {
    if (loadingRef.current) return;

    loadingRef.current = true;

    // Abort any in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);

    try {
      const data = await fetchProductsAPI(
        fetch,
        {
          limit: 50,
          cursor: null,
          query: queryString || undefined,
          filters: filterGroups,
        },
        abortRef.current.signal
      );

      reset(); // Clear store completely
      upsertMany(data.products, true);
      setPageInfo(data.pageInfo);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Initial load failed:", err);
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [
    fetch,
    queryString,
    filterGroups,
    reset,
    upsertMany,
    setPageInfo,
    setLoading,
  ]);

  /* ------------------------------------------------------------------ */
  /* LOAD NEXT PAGE */
  /* ------------------------------------------------------------------ */

  const loadMore = useCallback(async () => {
    if (
      loadingRef.current ||
      !hasNextPage ||
      !endCursor
    ) {
      return;
    }

    loadingRef.current = true;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setFetchingNext(true);

    try {
      const data = await fetchProductsAPI(
        fetch,
        {
          limit: 50,
          cursor: endCursor,
          query: queryString || undefined,
          filters: filterGroups,
        },
        abortRef.current.signal
      );

      upsertMany(data.products, false);
      setPageInfo(data.pageInfo);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Pagination failed:", err);
      }
    } finally {
      loadingRef.current = false;
      setFetchingNext(false);
    }
  }, [
    fetch,
    hasNextPage,
    endCursor,
    queryString,
    filterGroups,
    upsertMany,
    setPageInfo,
    setFetchingNext,
  ]);

  /* ------------------------------------------------------------------ */
  /* AUTO-RELOAD ON FILTER CHANGE */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (prevQueryRef.current !== queryString) {
      prevQueryRef.current = queryString;
      loadInitial();
    }
  }, [queryString, loadInitial]);

  /* ------------------------------------------------------------------ */
  /* INITIAL MOUNT */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    loadInitial();

    return () => {
      abortRef.current?.abort();
    };
    // ⚠️ intentional: run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------------------------ */
  /* PUBLIC API */
  /* ------------------------------------------------------------------ */

  return {
    loadMore,
    reload: loadInitial,
    hasNextPage,
  };
}
