import { Button, Popover, OptionList } from "@shopify/polaris";
import React, { useState } from "react";
import { useProductStore } from "../../../state/productStore";

export default function ColumnSelector(): JSX.Element {
  const [open, setOpen] = useState<boolean>(false);
  const toggle = (): void => setOpen((o) => !o);

  const columns = useProductStore((s) => s.columns);
  const setColumns = useProductStore((s) => s.setColumns);

  return (
    <Popover
      active={open}
      activator={<Button onClick={toggle}>Columns</Button>}
      onClose={toggle}
    >
      <OptionList
        title="Visible Columns"
        onChange={(selected: string[]) => setColumns(selected)}
        selected={columns}
        options={[
          { label: "Title", value: "title" },
          { label: "Vendor", value: "vendor" },
          { label: "Price", value: "price" },
        ]}
      />
    </Popover>
  );
}
