// components/MetafieldKeyPicker.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BlockStack, Button, Collapsible, ChoiceList, TextField } from "@shopify/polaris";
import { ChevronDownIcon, ChevronUpIcon } from "@shopify/polaris-icons";

type OwnerType = "PRODUCT" | "VARIANT" | "COLLECTION";

type Item = {
  namespace: string;
  key: string;
  type: string;
  label: string;
  count?: number;
};

type Resp = {
  items: Item[];
  pageInfo: { nextCursor: string | null; hasNext: boolean };
};

export function MetafieldKeyPicker({
  ownerType,
  selected,
  onChange,
  label = "Metafield key",
  disabled,
  isOpen,
  onToggle,
  typeFilter, // optional: constrain to a type
}: {
  ownerType: OwnerType;
  selected: string[]; // encoded as "namespace|||key|||type"
  onChange: (values: string[]) => void;
  label?: string;
  disabled?: boolean;
  isOpen: boolean;
  onToggle: () => void;
  typeFilter?: string | null;
}) {
  const [inputValue, setInputValue] = useState("");
  const [options, setOptions] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);

  const debounceRef = useRef<number | null>(null);
  const latestQueryRef = useRef<string>("");

  const fetchKeys = useCallback(
    async ({ q, cursor }: { q: string; cursor?: string | null }) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("ownerType", ownerType);
        params.set("q", q);
        params.set("limit", "50");
        if (typeFilter) params.set("type", typeFilter);
        if (cursor) params.set("cursor", cursor);

        const r = await fetch(`/api/metafields/keys/search?${params.toString()}`);
        const data: Resp = await r.json();

        setOptions((prev) => (cursor ? [...prev, ...data.items] : data.items));
        setNextCursor(data.pageInfo.nextCursor);
        setHasNext(Boolean(data.pageInfo.hasNext && data.pageInfo.nextCursor));
      } finally {
        setLoading(false);
      }
    },
    [ownerType, typeFilter]
  );

  useEffect(() => {
    if (disabled || !isOpen) return;
    fetchKeys({ q: "", cursor: null });
  }, [disabled, isOpen, fetchKeys]);

  const onInputChange = useCallback(
    (val: string) => {
      setInputValue(val);
      latestQueryRef.current = val;
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        fetchKeys({ q: val.trim().toLowerCase(), cursor: null });
      }, 200);
    },
    [fetchKeys]
  );

  const loadMore = useCallback(() => {
    if (!hasNext || loading) return;
    fetchKeys({ q: latestQueryRef.current.trim().toLowerCase(), cursor: nextCursor });
  }, [fetchKeys, hasNext, loading, nextCursor]);

  // Encode triple as one string for ChoiceList
  const polarisChoices = useMemo(
    () =>
      options.map((o) => ({
        value: `${o.namespace}|||${o.key}|||${o.type}`,
        label: o.label,
      })),
    [options]
  );

  return (
    <BlockStack gap="200">
      <Button
        variant="plain"
        icon={isOpen ? ChevronUpIcon : ChevronDownIcon}
        onClick={onToggle}
        textAlign="left"
        disabled={disabled}
      >
        {label}
      </Button>
      <Collapsible open={isOpen}>
        <BlockStack gap="200">
          <TextField
            placeholder="Search namespace or key..."
            value={inputValue}
            onChange={onInputChange}
            disabled={disabled || loading}
          />
          {polarisChoices.length > 0 ? (
            <ChoiceList
              titleHidden
              allowMultiple
              choices={polarisChoices}
              selected={selected}
              onChange={onChange}
              disabled={disabled || loading}
            />
          ) : (
            <div style={{ padding: "12px", fontSize: "14px", color: "#666" }}>
              {loading ? "Loading..." : inputValue.trim() ? `No metafield keys found for "${inputValue.trim()}".` : "No metafield keys found."}
            </div>
          )}
          {hasNext && (
            <Button
              onClick={loadMore}
              disabled={loading || !hasNext}
              variant="plain"
              size="slim"
            >
              {loading ? "Loading..." : "Load more"}
            </Button>
          )}
        </BlockStack>
      </Collapsible>
    </BlockStack>
  );
}
