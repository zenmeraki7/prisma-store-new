// web/frontend/utils/shallow.ts

/**
 * Shallow equality check for Zustand selectors and React.memo
 *
 * ⚡ CORE PERFORMANCE UTILITY
 * - Prevents unnecessary re-renders when object reference changes
 *   but values remain identical
 * - Used heavily in tables, rows, and stores
 *
 * Complexity: O(N) where N = number of keys (small & bounded)
 */
export function shallow<T extends Record<string, any>>(
  a: T,
  b: T
): boolean {
  if (Object.is(a, b)) return true;

  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null
  ) {
    return false;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];

    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      !Object.is(a[key], b[key])
    ) {
      return false;
    }
  }

  return true;
}
