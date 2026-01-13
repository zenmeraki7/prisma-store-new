// web/frontend/src/components/VirtualizedProductList.tsx
import {
  memo,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import { ProductRow } from "./ProductRow";
import type { ProductSummary } from "../../types/product";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface VirtualizedProductListProps {
  products: ProductSummary[];
  loading: boolean;
  onLoadMore?: () => void;
}

/* ------------------------------------------------------------------ */
/* Constants (hoisted for perf)                                        */
/* ------------------------------------------------------------------ */

const CONTAINER_HEIGHT = 600;
const ESTIMATED_ROW_HEIGHT = 72;
const OVERSCAN = 8;
const LOAD_MORE_PLACEHOLDER_ROWS = 1;

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export const VirtualizedProductList = memo(
  function VirtualizedProductList({
    products,
    loading,
    onLoadMore,
  }: VirtualizedProductListProps): JSX.Element {
    const parentRef =
      useRef<HTMLDivElement | null>(null);

    const loadMoreTriggeredRef =
      useRef<boolean>(false);

    const rowVirtualizer = useVirtualizer({
      count: onLoadMore
        ? products.length + LOAD_MORE_PLACEHOLDER_ROWS
        : products.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => ESTIMATED_ROW_HEIGHT,
      overscan: OVERSCAN,
    });

    /* -------------------------------------------------------------- */
    /* Load-more trigger (NO render side effects)                      */
    /* -------------------------------------------------------------- */

    const maybeLoadMore = useCallback(() => {
      if (
        !onLoadMore ||
        loading ||
        loadMoreTriggeredRef.current
      ) {
        return;
      }

      const virtualItems =
        rowVirtualizer.getVirtualItems();
      const lastItem =
        virtualItems[virtualItems.length - 1];

      if (
        lastItem &&
        lastItem.index >= products.length - 1
      ) {
        loadMoreTriggeredRef.current = true;
        onLoadMore();
      }
    }, [
      onLoadMore,
      loading,
      products.length,
      rowVirtualizer,
    ]);

    useEffect(() => {
      maybeLoadMore();
    }, [maybeLoadMore]);

    useEffect(() => {
      if (!loading) {
        loadMoreTriggeredRef.current = false;
      }
    }, [loading]);

    /* -------------------------------------------------------------- */
    /* Render                                                         */
    /* -------------------------------------------------------------- */

    return (
  <div>
  {/* Table Header */}
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "60px 2fr 1fr 1fr 1fr",
      padding: "10px 15px",
      fontWeight: 600,
      borderBottom: "2px solid #ccc",
      backgroundColor: "#f9f9f9",
    }}
  >
    <span>Image</span>
    <span>Product</span>
    <span>Price</span>
    <span>Vendor</span>
    <span>Status</span>
  </div>

  {/* Virtualized Rows */}
  <div
    ref={parentRef}
    style={{ height: CONTAINER_HEIGHT, overflow: "auto" }}
  >
    <div
      style={{
        height: rowVirtualizer.getTotalSize(),
        position: "relative",
      }}
    >
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const product = products[virtualRow.index];
        if (!product) return null;
        return (
          <div
            key={product.id}
            ref={rowVirtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <ProductRow product={product} />
          </div>
        );
      })}
    </div>
  </div>
</div>

    );
  }
);
