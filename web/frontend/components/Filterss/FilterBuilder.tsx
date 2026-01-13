import { Modal, Button, Box, BlockStack, InlineStack } from "@shopify/polaris";
import { FilterGroup } from "./FilterGroup";
import { useState } from "react";
import { useFilterState } from "../../filters/useFilterState";

type Props = {
  filterState: ReturnType<typeof useFilterState>;
  onClose?: () => void;
  onProductsFetched?: (data: any) => void;
  fetchProducts?: (args: { direction: string; filter: any }) => Promise<any>;
};

export function FilterBuilder({
  filterState,
  onClose,
  onProductsFetched,
  fetchProducts,
}: Props) {
  const { draft, setDraft, applyDraft, clearAll, appliedCount } = filterState;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleApplyFilters = async () => {
    applyDraft();

    if (fetchProducts) {
      try {
        setLoading(true);
        const data = await fetchProducts({
          direction: "next",
          filter: draft,
        });
        onProductsFetched?.(data);
      } finally {
        setLoading(false);
      }
    }

    setOpen(false);
    onClose?.();
  };

  return (
    <BlockStack>
      <InlineStack align="start">
        <Button onClick={() => setOpen(true)}>
          Filters{appliedCount ? ` (${appliedCount})` : ""}
        </Button>
      </InlineStack>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          onClose?.();
        }}
        title="Filter Products"
        size="large" // ✅ BIG MODAL
        primaryAction={{
          content: "Apply Filters",
          onAction: handleApplyFilters,
          loading,
        }}
        secondaryActions={[
          {
            content: "Clear All",
            onAction: clearAll,
          },
        ]}
      >
        <Modal.Section>
          {/* IMPORTANT: BlockStack prevents center alignment */}
          <BlockStack gap="400" inlineAlignment="start">
            <Box width="100%">
              <FilterGroup group={draft} onChange={setDraft} />
            </Box>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
