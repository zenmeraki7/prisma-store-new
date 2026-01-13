import {
  BlockStack,
  Button,
  Collapsible,
  Select,
  TextField,
} from "@shopify/polaris";
import { ChevronDownIcon, ChevronUpIcon } from "@shopify/polaris-icons";

/* ---------------- operators ---------------- */

const OPERATORS = [
  { label: "equals", value: "equals" },
  { label: "does not equal", value: "not_equals" },

  { label: "contains", value: "contains" },
  { label: "does not contain", value: "not_contains" },

  { label: "starts with", value: "starts_with" },
  { label: "does not start with", value: "not_starts_with" },

  { label: "ends with", value: "ends_with" },
  { label: "does not end with", value: "not_ends_with" },

  { label: "contains any of the words", value: "contains_any_words" },

  { label: "is empty / blank", value: "is_blank" },
  { label: "is not empty / blank", value: "is_not_blank" },

  { label: "equals (case insensitive)", value: "equals_ci" },
  { label: "contains (case insensitive)", value: "contains_ci" },
];

/* ---------------- props ---------------- */

type SkuFilterProps = {
  isOpen: boolean;
  onToggle: () => void;

  operator: string;
  onOperatorChange: (value: string) => void;

  value: string;
  onValueChange: (value: string) => void;
};

/* ---------------- component ---------------- */

export function SkuFilter({
  isOpen,
  onToggle,
  operator,
  onOperatorChange,
  value,
  onValueChange,
}: SkuFilterProps) {
  const isValueDisabled =
    operator === "is_blank" || operator === "is_not_blank";

  return (
    <BlockStack gap="200">
      <Button
        variant="plain"
        icon={isOpen ? ChevronUpIcon : ChevronDownIcon}
        onClick={onToggle}
        textAlign="left"
      >
        SKU
      </Button>

      <Collapsible open={isOpen}>
        <BlockStack gap="200">
          <Select
            label="Operator"
            options={OPERATORS}
            value={operator}
            onChange={onOperatorChange}
          />

          <TextField
            label="SKU value"
            value={value}
            onChange={onValueChange}
            autoComplete="off"
            disabled={isValueDisabled}
            placeholder={
              isValueDisabled ? "No value required" : "Enter SKU"
            }
          />
        </BlockStack>
      </Collapsible>
    </BlockStack>
  );
}

export default SkuFilter;
