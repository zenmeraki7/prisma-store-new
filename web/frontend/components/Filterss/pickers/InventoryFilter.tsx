import { BlockStack, Button, Collapsible, TextField, InlineStack } from "@shopify/polaris";
import { ChevronDownIcon, ChevronUpIcon } from "@shopify/polaris-icons";

type InventoryFilterProps = {
  isOpen: boolean;
  onToggle: () => void;
  min: string;
  max: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
};

export function InventoryFilter({ isOpen, onToggle, min, max, onMinChange, onMaxChange }: InventoryFilterProps) {
  return (
    <BlockStack gap="200">
      <Button
        variant="plain"
        icon={isOpen ? ChevronUpIcon : ChevronDownIcon}
        onClick={onToggle}
        textAlign="left"
      >
        Inventory
      </Button>
      <Collapsible open={isOpen}>
        <InlineStack gap="300">
          <TextField label="Min" value={min} onChange={onMinChange} autoComplete="off" />
          <TextField label="Max" value={max} onChange={onMaxChange} autoComplete="off" />
        </InlineStack>
      </Collapsible>
    </BlockStack>
  );
}