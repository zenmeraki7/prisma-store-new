import React, { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import VariantRow from "./VariantRow";
import { useProductStore } from "../../../state/productStore";

type VirtualVariantTableProps = {
  productId: string;
};

export default function VirtualVariantTable({
  productId,
}: VirtualVariantTableProps): JSX.Element {
  const parentRef = useRef<HTMLDivElement | null>(null);

  const variants = useProductStore(
    (s) => s.productMap[productId]?.variants ?? []
  );

  const rowVirtualizer = useVirtualizer({
    count: variants.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 10,
  });

  return (
    <div
      ref={parentRef}
      style={{
        height: 300,
        overflow: "auto",
        borderTop: "1px solid #ddd",
      }}
    >
      <div
        style={{
          height: rowVirtualizer.getTotalSize(),
          position: "relative",
          width: "100%",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const variant = variants[virtualRow.index];

          return (
            <div
              key={virtualRow.key}
              ref={rowVirtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                transform: `translateY(${virtualRow.start}px)`,
                width: "100%",
              }}
            >
              <VariantRow variant={variant} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
