import React from "react";
import { Text } from "@shopify/polaris";

type Variant = {
  title: string;
  sku: string;
  price: string | number;
};

type VariantRowProps = {
  variant: Variant;
};

function VariantRow({ variant }: VariantRowProps): JSX.Element {
  return (
    <div style={{ display: "flex", padding: 8, borderBottom: "1px solid #eee" }}>
      <div style={{ flex: 1 }}>{variant.title}</div>
      <div style={{ flex: 1 }}>{variant.sku}</div>
      <div style={{ flex: 1 }}>{variant.price}</div>
    </div>
  );
}

export default React.memo(VariantRow);
