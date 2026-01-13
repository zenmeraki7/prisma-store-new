import { TextField } from "@shopify/polaris";
import React, { useState, useEffect } from "react";
import { shallow } from "zustand/shallow";
import { useProductStore } from "../../../state/productStore";

type SKUEditorProps = {
  id: string;
};

function SKUEditorComponent({ id }: SKUEditorProps): JSX.Element {
  const sku = useProductStore(
    (s) => s.productMap[id]?.sku ?? "",
    shallow
  );

  const updateField = useProductStore((s) => s.updateField);

  const [localValue, setLocalValue] = useState<string>(sku);

  // Sync local state if SKU changes externally
  useEffect(() => {
    setLocalValue(sku);
  }, [sku]);

  const onChange = (value: string): void => {
    setLocalValue(value);
    updateField(id, "sku", value);
  };

  return (
    <TextField
      label=""
      autoComplete="off"
      value={localValue}
      onChange={onChange}
    />
  );
}

export const SKUEditor = React.memo(SKUEditorComponent);
export default SKUEditor;
