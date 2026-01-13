import {
  BlockStack,
  Button,
  Collapsible,
  TextField,
  Select,
} from "@shopify/polaris";
import { ChevronDownIcon, ChevronUpIcon } from "@shopify/polaris-icons";
import { FILTER_REGISTRY } from "../filters/registry";
import { OPERATOR_LABELS } from "../filters/operatorLabels";

type PriceProps = {
  isOpen: boolean;
  onToggle: () => void;
  operator: string;
  value: string;
  onOperatorChange: (value: string) => void;
  onValueChange: (value: string) => void;
};

const PRICE_OPERATORS =
  FILTER_REGISTRY["variant.price"].operators;

const NUMBER_OPERATOR_OPTIONS = PRICE_OPERATORS.map((op) => ({
  value: op,                           // eq / gt / gte / lt / lte
  label: OPERATOR_LABELS[op] ?? op,    // = > ≥ < ≤
}));

export default function PriceFilter({
  isOpen,
  onToggle,
  operator,
  value,
  onOperatorChange,
  onValueChange,
}: PriceProps) {
  return (
    <BlockStack gap="200">
      <Button
        variant="plain"
        icon={isOpen ? ChevronUpIcon : ChevronDownIcon}
        onClick={onToggle}
        textAlign="left"
      >
        Price
      </Button>

      <Collapsible open={isOpen}>
        <BlockStack gap="200">
          <Select
            label="Condition"
            labelHidden
            options={NUMBER_OPERATOR_OPTIONS}
            value={operator}
            onChange={onOperatorChange}
          />

          <TextField
            label="Price"
            labelHidden
            type="number"
            value={value}
            onChange={onValueChange}
            autoComplete="off"
          />
        </BlockStack>
      </Collapsible>
    </BlockStack>
  );
}
