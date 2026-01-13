import {
  InlineStack,
  Select,
  Button,
  Text,
  Box,
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

  if (!fieldMeta) {
    return (
      <InlineStack gap="200" align="center">
        <Text as="p" tone="critical">Unknown field</Text>
        <Button size="slim" tone="critical" onClick={onRemove}>
          Remove
        </Button>
      </InlineStack>
    );
  }

  return (
    <InlineStack
      gap="300"
      align="center"
      wrap={false}          // 🔑 force single line
    >
      {/* Field */}
      <Box minWidth="160px">
        <Select
          label="Field"
          labelHidden
          options={Object.entries(FILTER_REGISTRY).map(([key, meta]) => ({
            label: meta.label,
            value: key,
          }))}
          value={condition.field}
          onChange={(field) =>
            onChange({
              field,
              op: FILTER_REGISTRY[field].defaultOperator,
              value: FILTER_REGISTRY[field].defaultValue ?? null,
            })
          }
        />
      </Box>

      {/* Operator */}
      <Box minWidth="160px">
        <Select
          label="Operator"
          labelHidden
          options={fieldMeta.operators.map((op) => ({
            label: fieldMeta.operatorLabels?.[op] ?? op,
            value: op,
          }))}
          value={condition.op}
          onChange={(op) =>
            onChange({
              ...condition,
              op,
              value: fieldMeta.resetValueOnOperatorChange
                ? fieldMeta.defaultValue ?? null
                : condition.value,
            })
          }
        />
      </Box>

      {/* Value */}
      <Box minWidth="360px">
        <ValueInput
          type={fieldMeta.type}
          operator={condition.op}
          picker={fieldMeta.picker}
          value={condition.value}
          onChange={(value) =>
            onChange({
              ...condition,
              value,
            })
          }
        />
      </Box>

      {/* Remove */}
      <Button size="slim" tone="critical" onClick={onRemove}>
        ✕
      </Button>
    </InlineStack>
  );
}
