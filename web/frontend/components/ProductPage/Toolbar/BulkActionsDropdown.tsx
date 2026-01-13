import { Popover, Button, ActionList } from "@shopify/polaris";
import React, { useState } from "react";
import { useProductStore } from "../../../state/productStore";

export default function BulkActionsDropdown(): JSX.Element {
  const [open, setOpen] = useState<boolean>(false);
  const toggle = (): void => setOpen((o) => !o);

  const openBulkModal = useProductStore((s) => s.openBulkModal);

  return (
    <Popover
      active={open}
      activator={<Button onClick={toggle}>Bulk Actions</Button>}
      onClose={toggle}
    >
      <ActionList
        actionRole="menuitem"
        items={[
          {
            content: "Bulk Edit",
            onAction: (): void => {
              toggle();
              openBulkModal();
            },
          },
          {
            content: "Bulk Export",
            onAction: (): void => alert("Export not implemented"),
          },
        ]}
      />
    </Popover>
  );
}
