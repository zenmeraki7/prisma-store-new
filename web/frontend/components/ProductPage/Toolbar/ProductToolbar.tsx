import { Box, Button, ButtonGroup } from "@shopify/polaris";
import React from "react";
import BulkActionsDropdown from "./BulkActionsDropdown";
import ColumnSelector from "./ColumnSelector";
import { useProductStore } from "../../../state/productStore";

export default function ProductToolbar(): JSX.Element {
  const selectedCount = useProductStore((s) => s.selection.length);

  return (
    <Box padding="4" background="bg-subdued">
      <ButtonGroup>
        <BulkActionsDropdown />

        <ColumnSelector />

        <Button
          disabled={selectedCount === 0}
          destructive
        >
          Delete ({selectedCount})
        </Button>
      </ButtonGroup>
    </Box>
  );
}
