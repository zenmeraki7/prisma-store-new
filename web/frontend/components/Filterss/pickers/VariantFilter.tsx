import { BlockStack, Button, Collapsible, TextField, InlineStack } from "@shopify/polaris";
import { ChevronDownIcon, ChevronUpIcon } from "@shopify/polaris-icons";

type VariantFilterProps = {
  isOpen: boolean;
  onToggle: () => void;
  sku: string;
  priceMin: string;
  priceMax: string;
  onSkuChange: (value: string) => void;
  onPriceMinChange: (value: string) => void;
  onPriceMaxChange: (value: string) => void;
};

export function VariantFilter({ 
  isOpen, 
  onToggle, 
  sku, 
  priceMin, 
  priceMax, 
  onSkuChange, 
  onPriceMinChange, 
  onPriceMaxChange 
}: VariantFilterProps) {
  return (
    <BlockStack gap="200">
      <Button
        variant="plain"
        icon={isOpen ? ChevronUpIcon : ChevronDownIcon}
        onClick={onToggle}
        textAlign="left"
      >
        Variant
      </Button>
      <Collapsible open={isOpen}>
        <BlockStack gap="300">
          <TextField
            label="SKU contains"
            value={sku}
            onChange={onSkuChange}
            autoComplete="off"
          />
          <InlineStack gap="300">
            <TextField
              label="Price min"
              value={priceMin}
              onChange={onPriceMinChange}
              autoComplete="off"
            />
            <TextField
              label="Price max"
              value={priceMax}
              onChange={onPriceMaxChange}
              autoComplete="off"
            />
          </InlineStack>
        </BlockStack>
      </Collapsible>
    </BlockStack>
  );
}