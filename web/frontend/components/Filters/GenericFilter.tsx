import {
  InlineStack,
  Select,
  Button,
  Text,
} from "@shopify/polaris";
import { FILTER_REGISTRY } from "../../filters/registry";
import { ValueInput } from "./ValueInput";

type Condition = {
  field: string;
  op: string;
  value: any;
};

type Props = {
  condition: Condition;
  onChange: (next: Condition) => void;
  onRemove: () => void;
};

export function GenericFilter({ condition, onChange, onRemove }: Props) {
  const fieldMeta = FILTER_REGISTRY[condition.field];

  /* ---------------- guards ---------------- */
  if (!fieldMeta) {
    return (
      <InlineStack gap="200">
        <Text as="p" tone="critical">Unknown field</Text>
        <Button size="slim" tone="critical" onClick={onRemove}>
          Remove
        </Button>
      </InlineStack>
    );
  }

  /* ---------------- handlers ---------------- */

  const onFieldChange = (field: string) => {
    const meta = FILTER_REGISTRY[field];

    onChange({
      field,
      op: meta.defaultOperator,
      value: meta.defaultValue ?? null,
    });
  };

  const onOperatorChange = (op: string) => {
    onChange({
      ...condition,
      op,
      value: fieldMeta.resetValueOnOperatorChange
        ? fieldMeta.defaultValue ?? null
        : condition.value,
    });
  };

  const onValueChange = (value: any) => {
    onChange({
      ...condition,
      value,
    });
  };

  /* ---------------- UI ---------------- */

  return (
    <InlineStack gap="200" align="center">
      {/* Field selector */}
      <Select
        label="Field"
        labelHidden
        options={Object.entries(FILTER_REGISTRY).map(([key, meta]) => ({
          label: meta.label,
          value: key,
        }))}
        value={condition.field}
        onChange={onFieldChange}
      />

      {/* Operator selector */}
      <Select
        label="Operator"
        labelHidden
        options={fieldMeta.operators.map((op) => ({
          label: fieldMeta.operatorLabels?.[op] ?? op,
          value: op,
        }))}
        value={condition.op}
        onChange={onOperatorChange}
      />

      {/* Value input */}
      <ValueInput
        type={fieldMeta.type}
        operator={condition.op}
        picker={fieldMeta.picker}
        value={condition.value}
        onChange={onValueChange}
      />

      {/* Remove */}
      <Button
        size="slim"
        tone="critical"
        onClick={onRemove}
      >
        ✕
      </Button>
    </InlineStack>
  );
}