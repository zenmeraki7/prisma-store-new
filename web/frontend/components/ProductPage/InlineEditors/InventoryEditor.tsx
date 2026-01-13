import { TextField, Box, Text } from "@shopify/polaris";
import React, { useState } from "react";
import { shallow } from "zustand/shallow";
import { useProductStore } from "../../../state/productStore";
import { useDebounce } from "../../../utils/useDebounce";

/* ---------- Types ---------- */

type InventoryMap = Record<string, number>;

type InventoryEditorProps = {
  id: string;
};

type LocationQtyInputProps = {
  productId: string;
  locationId: string;
  initialQty: number;
  updateField: (
    productId: string,
    fieldPath: string,
    value: number
  ) => void;
};

/* ---------- Components ---------- */

function InventoryEditorComponent({
  id,
}: InventoryEditorProps): JSX.Element {
  const inventory = useProductStore(
    (s) => s.productMap[id]?.inventoryLocations as InventoryMap | undefined,
    shallow
  );

  const updateField = useProductStore((s) => s.updateField);

  if (!inventory) {
    return <Text>-</Text>;
  }

  return (
    <Box padding="100">
      {Object.entries(inventory).map(([locId, qty]) => (
        <LocationQtyInput
          key={locId}
          productId={id}
          locationId={locId}
          initialQty={qty}
          updateField={updateField}
        />
      ))}
    </Box>
  );
}

function LocationQtyInput({
  productId,
  locationId,
  initialQty,
  updateField,
}: LocationQtyInputProps): JSX.Element {
  const [local, setLocal] = useState<number>(initialQty);
  const debouncedUpdate = useDebounce(updateField, 200);

  const onChange = (value: string): void => {
    const numeric = Number(value);
    setLocal(numeric);
    debouncedUpdate(
      productId,
      `inventoryLocations.${locationId}`,
      numeric
    );
  };

  return (
    <Box paddingBlock="100">
      <Text as="span" variant="bodySm">
        {locationId}
      </Text>

      <TextField
        label=""
        type="number"
        value={String(local)}
        onChange={onChange}
      />
    </Box>
  );
}

export default React.memo(InventoryEditorComponent);


