// components/filters/FilterBuilder.tsx
import {
  Popover,
  Button,
  Box,
  BlockStack,
  Divider,
  InlineStack,
} from "@shopify/polaris";
import { FilterGroup } from "./FilterGroup";
import { useState } from "react";
import { useFilterState } from "../../filters/useFilterState";

type Props = {
  filterState: ReturnType<typeof useFilterState>;
  onClose?: () => void;
};

export function FilterBuilder({ filterState, onClose }: Props) {
  const { draft, setDraft, applyDraft, clearAll, appliedCount } = filterState;
  const [open, setOpen] = useState(false);

  const handleApplyFilters = () => {
    applyDraft();      // ✅ updates applied DSL in Products.tsx
    setOpen(false);
    onClose?.();
  };

  return (
    <BlockStack>
      <Popover
        active={open}
        activator={
          <Button onClick={() => setOpen(true)}>
            Filters{appliedCount ? ` (${appliedCount})` : ""}
          </Button>
        }
        onClose={() => {
          setOpen(false);
          onClose?.();
        }}
      >
        <Box padding="300" width="420px">
          <BlockStack gap="300">
            {/* ROOT GROUP */}
            <FilterGroup group={draft} onChange={setDraft} />

            <Divider />

            <InlineStack align="end" gap="200">
              
              <Button variant="primary" onClick={handleApplyFilters}>
                Apply Filters
              </Button>
            </InlineStack>
          </BlockStack>
        </Box>
      </Popover>
    </BlockStack>
  );
}