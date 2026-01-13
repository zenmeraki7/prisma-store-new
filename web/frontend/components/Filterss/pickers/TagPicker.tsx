// components/TagPicker.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BlockStack, Button, Collapsible, ChoiceList, TextField } from "@shopify/polaris";
import { ChevronDownIcon, ChevronUpIcon } from "@shopify/polaris-icons";

type TagOption = { value: string; label: string; count?: number };

type SearchResp = {
  items: TagOption[];
  pageInfo: { nextCursor: string | null; hasNext: boolean };
};

export function TagPicker({
  selected,
  onChange,
  label = "Tag",
  disabled,
  isOpen,
  onToggle,
}: {
  selected: string[]; // selected tag values array
  onChange: (tags: string[]) => void;
  label?: string;
  disabled?: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [inputValue, setInputValue] = useState("");
  const [options, setOptions] = useState<TagOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);

  const debounceRef = useRef<number | null>(null);
  const latestQueryRef = useRef<string>("");

  const fetchTags = useCallback(async ({ q, cursor }: { q: string; cursor?: string | null }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("q", q);
      params.set("limit", "50");
      if (cursor) params.set("cursor", cursor);

      const r = await fetch(`/api/tags/search?${params.toString()}`);
      const data: SearchResp = await r.json();

      setOptions((prev) => (cursor ? [...prev, ...data.items] : data.items));
      setNextCursor(data.pageInfo.nextCursor);
      setHasNext(Boolean(data.pageInfo.hasNext && data.pageInfo.nextCursor));
    } finally {
      setLoading(false);
    }
  }, []);

  const onInputChange = useCallback(
    (val: string) => {
      setInputValue(val);
      latestQueryRef.current = val;
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        fetchTags({ q: val.trim().toLowerCase(), cursor: null });
      }, 200);
    },
    [fetchTags]
  );

  useEffect(() => {
    if (disabled || !isOpen) return;
    fetchTags({ q: "", cursor: null });
  }, [disabled, isOpen, fetchTags]);

  const loadMore = useCallback(() => {
    if (!hasNext || loading) return;
    fetchTags({ q: latestQueryRef.current.trim().toLowerCase(), cursor: nextCursor });
  }, [fetchTags, hasNext, loading, nextCursor]);

  const polarisChoices = useMemo(
    () => options.map((o) => ({ value: o.value, label: o.label })),
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
            placeholder="Search tags..."
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
              {loading ? "Loading..." : inputValue.trim() ? `No tags found for "${inputValue.trim()}".` : "No tags found."}
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
