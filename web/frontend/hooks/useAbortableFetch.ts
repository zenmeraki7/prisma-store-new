// web/frontend/hooks/useAbortableFetch.ts

import { useRef, useCallback, useEffect } from "react";

/**
 * Abort controller manager for fetch-like APIs
 *
 * Responsibilities:
 * - Aborts the previous request when a new one starts
 * - Aborts in-flight request on component unmount
 *
 * ⚡ Designed for:
 * - Infinite scroll
 * - Fast typing / rapid interactions
 * - Preventing zombie network requests
 */
export function useAbortableFetch() {
  const controllerRef = useRef<AbortController | null>(null);

  const getSignal = useCallback((): AbortSignal => {
    // Abort any in-flight request
    controllerRef.current?.abort();

    // Create a fresh controller for the next request
    const controller = new AbortController();
    controllerRef.current = controller;

    return controller.signal;
  }, []);

  useEffect(() => {
    // Abort on unmount
    return () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, []);

  return { getSignal };
}
