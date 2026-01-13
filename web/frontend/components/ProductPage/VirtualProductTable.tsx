import React, { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Card, Box } from "@shopify/polaris";
import { useProductStore } from "../../state/productStore";
import {ProductRow} from "../ProductTable/ProductRow";

export default function VirtualProductTable(): JSX.Element {
  const parentRef = useRef<HTMLDivElement | null>(null);

  // Zustand store
  const products = useProductStore((s) => s.products);
  const columns = useProductStore((s) => s.columns);

  const rowHeight = 52;

  const rowVirtualizer = useVirtualizer({
    count: products.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <Card>
      {/* Header */}
      <Box padding="2" background="bg-subdued">
        <div style={{ display: "flex", padding: "8px 12px", fontWeight: 600 }}>
          <div style={{ width: 40 }}></div> {/* Checkbox column */}
          {columns.map((col) => (
            <div key={col} style={{ flex: 1 }}>
              {col.toUpperCase()}
            </div>
          ))}
          <div style={{ width: 80 }}>Actions</div>
        </div>
      </Box>

      {/* Virtualized Body */}
      <div
        ref={parentRef}
        style={{
          height: "75vh",
          overflow: "auto",
          position: "relative",
        }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualItems.map((virtualRow) => {
            const index = virtualRow.index;
            const product = products[index];

            return (
              <div
                key={virtualRow.key}
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
    </Card>
  );
}

