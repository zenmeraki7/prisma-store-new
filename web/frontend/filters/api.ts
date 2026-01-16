 export async function fetchProducts({
   cursor,
   direction = "next",   // ✅ DEFAULT
   query,
   filter,
  limit = 50,
 }: {
   cursor?: string | null;
   direction?: "next" | "prev";  // ✅ OPTIONAL
   query?: string;
   filter?: any;
 limit?: number;
 }) {
  const r = await fetch("/api/products/search", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      limit,
      cursor,
      direction,
      query,
      ...(filter ? { filter } : {}),
    }),
  });

  const text = await r.text();
  if (!r.ok) {
    throw new Error(`HTTP ${r.status} ${r.statusText}: ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON but got: ${text.slice(0, 300)}`);
  }
}