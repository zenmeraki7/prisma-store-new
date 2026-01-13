import { useState, useEffect, useCallback } from "react";
import type { ProductSummary } from "../../frontend/types/product";

type Direction = "next" | "prev";

interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

interface ProductsResponse {
  products: ProductSummary[];
  pageInfo: PageInfo;
}

export function useProductsPage() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchPage = useCallback(async (direction: Direction) => {
    setIsLoading(true);

    const params = new URLSearchParams();
    params.set("direction", direction);
    if (cursor) params.set("cursor", cursor);

    try {
      const res = await fetch(`/api/products?${params.toString()}`, {
  credentials: "include",
});

      if (!res.ok) throw new Error("Failed to fetch");

      const data: ProductsResponse = await res.json();
      console.log("Fetched products:", data.products);

      setProducts(data.products);
      setPageInfo(data.pageInfo);
      setCursor(direction === "next" ? data.pageInfo.endCursor : data.pageInfo.startCursor);
    } catch (err) {
      console.error("Error fetching products:", err);
    } finally {
      setIsLoading(false);
    }
  }, [cursor]);

  useEffect(() => {
    fetchPage("next");
  }, [fetchPage]);

  return { products, pageInfo, isLoading, loadNext: () => fetchPage("next"), loadPrev: () => fetchPage("prev") };
}