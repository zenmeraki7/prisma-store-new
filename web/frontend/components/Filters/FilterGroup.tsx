// components/filters/FilterGroup.tsx
import { BlockStack, InlineStack, Button, Text } from "@shopify/polaris";
import { GenericFilter } from "./GenericFilter";
import { FilterNode, FilterGroupNode } from "../../filters/types";

type Props = {
  group: FilterGroupNode;              // { and: FilterNode[] } | { or: FilterNode[] }
  onChange: (next: FilterGroupNode) => void;
};

export function FilterGroup({ group, onChange }: Props) {
  const isAnd = "and" in group;
  const nodes = isAnd ? group.and : group.or;

  const updateNode = (index: number, next: FilterNode) => {
    const updated = [...nodes];
    updated[index] = next;

    onChange(isAnd ? { and: updated } : { or: updated });
  };

  const removeNode = (index: number) => {
    const updated = nodes.filter((_, i) => i !== index);
    onChange(isAnd ? { and: updated } : { or: updated });
  };

  const addCondition = () => {
    const updated = [
      ...nodes,
      {
        condition: {
          field: "product.title",
          op: "contains",
          value: "",
        },
      },
    ];

    onChange(isAnd ? { and: updated } : { or: updated });
  };

  return (
    <BlockStack gap="300">
      {nodes.map((node, i) => {
        // Nested group
        if ("and" in node || "or" in node) {
          return (
            <BlockStack key={i} gap="200">
              <InlineStack align="space-between">
                <Text as="p" variant="bodySm" tone="subdued">
                  {isAnd ? "AND group" : "OR group"}
                </Text>

                <Button
                  size="slim"
                  tone="critical"
                  onClick={() => removeNode(i)}
                >
                  Remove
                </Button>
              </InlineStack>

              <FilterGroup
                group={node}
                onChange={(next) => updateNode(i, next)}
              />
            </BlockStack>
          );
        }

        // Simple condition
        return (
          <GenericFilter
            key={i}
            condition={node.condition}
            onChange={(cond) =>
              updateNode(i, { condition: cond })
            }
            onRemove={() => removeNode(i)}
          />
        );
      })}

      <InlineStack>
        <Button size="slim" onClick={addCondition}>
          + Add filter
        </Button>
      </InlineStack>
    </BlockStack>
  );
}