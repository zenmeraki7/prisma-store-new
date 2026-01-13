// web/frontend/src/components/ProductTable/ProductRow.tsx
import { memo } from "react";
import { Stack, Thumbnail, Text, Badge } from "@shopify/polaris";
import type { ProductSummary } from "../../types/product";

interface ProductRowProps {
  product: ProductSummary;
}

export const ProductRow = memo(({ product }: ProductRowProps) => {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "60px 2fr 1fr 1fr 1fr",
        alignItems: "center",
        padding: "10px 15px",
        borderBottom: "1px solid #eee",
        gap: "10px",
      }}
    >
      {/* Thumbnail */}
      <Thumbnail
        source={product.featuredImageUrl || "/placeholder.png"}
        alt={product.title}
        size="small"
      />

      {/* Title */}
      <Text variant="bodyMd" fontWeight="medium">
        {product.title}
      </Text>

      {/* Price */}
      <Text variant="bodyMd">${product.price}</Text>

      {/* Vendor */}
      <Text variant="bodyMd">{product.vendor || "-"}</Text>

      {/* Status / Badge */}
      <Badge status={product.available ? "success" : "critical"}>
        {product.available ? "Available" : "Out of stock"}
      </Badge>
    </div>
  );
});
