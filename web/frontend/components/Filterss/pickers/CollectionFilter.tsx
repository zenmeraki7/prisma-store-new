import {
  BlockStack,
  Button,
  Collapsible,
  Select,
  Autocomplete,
  InlineStack,
  Tag,
} from "@shopify/polaris";
import { ChevronDownIcon, ChevronUpIcon } from "@shopify/polaris-icons";
import { useCallback, useEffect, useRef, useState } from "react";

type CollectionFilterProps = {
  isOpen: boolean;
  onToggle: () => void;
  operator: string;
  value: string;
  onOperatorChange: (value: string) => void;
  onValueChange: (value: string) => void;
};

const OPERATOR_OPTIONS = [
  { label: "is", value: "is" },
  { label: "is not", value: "is_not" },
  { label: "contains any of the ids", value: "contains_any_ids" },
];

type ApiResp = {
  items: { id: string; title: string }[];
  pageInfo: {
    nextCursor: string | null;
    hasNext: boolean;
  };
};

export function CollectionFilter({
  isOpen,
  onToggle,
  operator,
  value,
  onOperatorChange,
  onValueChange,
}: CollectionFilterProps) {
  const ids = value ? value.split(",").filter(Boolean) : [];

  const [inputValue, setInputValue] = useState("");
  const [options, setOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [loading, setLoading] = useState(false);

  const nextCursorRef = useRef<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  const fetchCollections = useCallback(
    async (q: string, cursor?: string | null) => {
      setLoading(true);
      const params = new URLSearchParams({ q, limit: "20" });
      if (cursor) params.set("cursor", cursor);

      const r = await fetch(`/api/collections/search?${params.toString()}`);
      const data: ApiResp = await r.json();

      const mapped = data.items.map((c) => ({
        value: c.id,
        label: c.title,
      }));

      setOptions((prev) => (cursor ? [...prev, ...mapped] : mapped));
      nextCursorRef.current = data.pageInfo.nextCursor;
      setLoading(false);
    },
    []
  );

  const handleSearchChange = (val: string) => {
    setInputValue(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = window.setTimeout(() => {
      fetchCollections(val);
    }, 250);
  };

  useEffect(() => {
    fetchCollections("");
  }, [fetchCollections]);

  return (
    <BlockStack gap="200">
      <Button
        variant="plain"
        icon={isOpen ? ChevronUpIcon : ChevronDownIcon}
        onClick={onToggle}
        textAlign="left"
      >
        Collection
      </Button>

      <Collapsible open={isOpen}>
        <BlockStack gap="200">
          <Select
            label="Condition"
            options={OPERATOR_OPTIONS}
            value={operator}
            onChange={(op) => {
              onOperatorChange(op);
              onValueChange("");
            }}
          />

          {/* SINGLE */}
          {operator !== "contains_any_ids" && (
            <Autocomplete
              options={options}
              selected={ids[0] ? [ids[0]] : []}
              loading={loading}
              onSelect={(selected) => {
                onValueChange(selected[0] || "");
              }}
              textField={
                <Autocomplete.TextField
                  label="Collection"
                  value={inputValue}
                  onChange={handleSearchChange}
                  autoComplete="off"
                />
              }
            />
          )}

          {/* MULTI */}
          {operator === "contains_any_ids" && (
            <BlockStack gap="200">
              <Autocomplete
                options={options}
                selected={[]}
                loading={loading}
                onSelect={(selected) => {
                  const id = selected[0];
                  if (id && !ids.includes(id)) {
                    onValueChange([...ids, id].join(","));
                  }
                }}
                textField={
                  <Autocomplete.TextField
                    label="Collections"
                    value={inputValue}
                    onChange={handleSearchChange}
                    autoComplete="off"
                  />
                }
              />

              <InlineStack gap="200">
                {ids.map((id) => (
                  <Tag
                    key={id}
                    onRemove={() =>
                      onValueChange(ids.filter((x) => x !== id).join(","))
                    }
                  >
                    {id}
                  </Tag>
                ))}
              </InlineStack>
            </BlockStack>
          )}
        </BlockStack>
      </Collapsible>
    </BlockStack>
  );
}
