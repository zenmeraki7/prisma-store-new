export async function fetchProducts({
  cursor,
  direction = "next",   // ✅ DEFAULT
  query,
  filter,
}: {
  cursor?: string | null;
  direction?: "next" | "prev";  // ✅ OPTIONAL
  query?: string;
  filter?: any;
}) {
  const r = await fetch("/api/products/search", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      limit: 50,
      cursor,
      direction,
      query,
      ...(filter ? { filter } : {}),
    }),
  });

  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
