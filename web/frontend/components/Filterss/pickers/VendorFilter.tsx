import { BlockStack, Button, Collapsible, TextField, Select } from "@shopify/polaris";
import { ChevronDownIcon, ChevronUpIcon } from "@shopify/polaris-icons";

type VendorFilterProps = {
  isOpen: boolean;
  onToggle: () => void;
  operator: "contains" | "equals" | "not_contains";
  value: string;
  onOperatorChange: (op: "contains" | "equals" | "not_contains") => void;
  onValueChange: (value: string) => void;
};

export function VendorFilter({
  isOpen,
  onToggle,
  operator,
  value,
  onOperatorChange,
  onValueChange,
}: VendorFilterProps) {
  return (
    <BlockStack gap="200">
      <Button
        variant="plain"
        icon={isOpen ? ChevronUpIcon : ChevronDownIcon}
        onClick={onToggle}
        textAlign="left"
      >
        Vendor
      </Button>

      <Collapsible open={isOpen}>
        <BlockStack gap="200">
          <Select
            label="Operator"
            labelHidden
            options={[
              { label: "Contains", value: "contains" },
              { label: "Equals", value: "equals" },
              { label: "Does not contain", value: "not_contains" },
            ]}
            value={operator}
            onChange={onOperatorChange}
          />

          <TextField
            label="Vendor"
            value={value}
            onChange={onValueChange}
            autoComplete="off"
          />
        </BlockStack>
      </Collapsible>
    </BlockStack>
  );
}
