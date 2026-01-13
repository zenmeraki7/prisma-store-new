import React from "react";
import {
  BlockStack,
  Button,
  Collapsible,
  Select,
  TextField,
} from "@shopify/polaris";
import { ChevronDownIcon, ChevronUpIcon } from "@shopify/polaris-icons";

export type DateOperator =
  | "is_after"
  | "is_before"
  | "is_after_days"
  | "is_before_days";

const OPERATORS = [
  { label: "is after", value: "is_after" },
  { label: "is before", value: "is_before" },
  { label: "is after X days ago", value: "is_after_days" },
  { label: "is before X days ago", value: "is_before_days" },
];

type Props = {
  label: string;
  isOpen: boolean;
  onToggle: () => void;

  operator: DateOperator;
  value: string;

  onOperatorChange: (op: DateOperator) => void;
  onValueChange: (val: string) => void;
};

export default function DateFilter({
  label,
  isOpen,
  onToggle,
  operator,
  value,
  onOperatorChange,
  onValueChange,
}: Props) {
  const isDaysOperator =
    operator === "is_after_days" || operator === "is_before_days";

  return (
    <BlockStack gap="200">
      <Button
        variant="plain"
        icon={isOpen ? ChevronUpIcon : ChevronDownIcon}
        onClick={onToggle}
        textAlign="left"
      >
        {label}
      </Button>

      <Collapsible open={isOpen}>
        <BlockStack gap="200">
          <Select
            label="Operator"
            options={OPERATORS}
            value={operator}
            onChange={(v) => onOperatorChange(v as DateOperator)}
          />

          <TextField
            label={isDaysOperator ? "Days ago" : "Date"}
            type={isDaysOperator ? "number" : "date"}
            value={value}
            onChange={onValueChange}
            autoComplete="off"
          />
        </BlockStack>
      </Collapsible>
    </BlockStack>
  );
}
