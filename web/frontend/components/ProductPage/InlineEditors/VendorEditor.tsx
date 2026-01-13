import { TextField } from "@shopify/polaris";
import React from "react";
import { useProductStore } from "../../../state/productStore";

type Product = {
  id: string;
  vendor: string;
};

type VendorEditorProps = {
  product: Product;
};

export default function VendorEditor({
  product,
}: VendorEditorProps): JSX.Element {
  const update = useProductStore((s) => s.updateProductVendor);

  const handleChange = (value: string): void => {
    update(product.id, value);
  };

  return (
    <TextField
      label=""
      value={product.vendor}
      onChange={handleChange}
    />
  );
}
