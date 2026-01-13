// components/CollectionPicker.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Autocomplete, TextField, InlineStack, Button } from "@shopify/polaris";

export type CollectionOption = {
  id: string; // shopifyCollectionId (GID)
  title: string;
  handle?: string;
  type?: "SMART" | "CUSTOM";
};

type SearchResp = {
  items: CollectionOption[];
  pageInfo: {
    nextCursor: string | null;
    prevCursor: string | null;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

export function CollectionPicker({
  value,
  onChange,
  label = "Collection",
  placeholder = "Search collections",
  helpText,
  disabled,
}: {
  value: string; // selected collectionId (GID) or ""
  onChange: (collectionId: string, selected?: CollectionOption | null) => void;

  label?: string;
  placeholder?: string;
  helpText?: string;
  disabled?: boolean;
}) {
  const [inputValue, setInputValue] = useState("");
  const [options, setOptions] = useState<{ value: string; label: string }[]>(
    []
  );
  const [loading, setLoading] = useState(false);

  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);

  const selectedLabel = useMemo(() => {
    const found = options.find((o) => o.value === value);
    return found?.label || "";
  }, [options, value]);

  useEffect(() => {
    if (!value) return;

    const found = options.find((o) => o.value === value);
    if (found) {
      setInputValue(found.label);
    }
  }, [value, options]);
  const debounceRef = useRef<number | null>(null);
  const latestQueryRef = useRef<string>("");

  const fetchCollections = useCallback(
    async ({ q, cursor }: { q: string; cursor?: string | null }) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("q", q);
        params.set("limit", "20");
        if (cursor) params.set("cursor", cursor);

        // ✅ Use `q` instead of `val`
        const r = await fetch(`/api/collections/search?${params.toString()}`, {
          credentials: "include",
        });

        const data = await r.json();

        const mapped = data.items.map((c) => ({
          value: c.id,
          label: c.title,
        }));

        // If cursor is set, append; otherwise replace
        setOptions((prev) => (cursor ? [...prev, ...mapped] : mapped));
        setNextCursor(data.pageInfo.nextCursor);
        setHasNext(Boolean(data.pageInfo.hasNext && data.pageInfo.nextCursor));
      } catch (err) {
        console.error("❌ Failed to fetch collections:", err);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // On input change (debounced search)
  const handleInputChange = useCallback(
    (val: string) => {
      setInputValue(val);

      if (debounceRef.current) window.clearTimeout(debounceRef.current);

      debounceRef.current = window.setTimeout(() => {
        latestQueryRef.current = val;
        fetchCollections({ q: val, cursor: null });
      }, 250);
    },
    [fetchCollections]
  );

  // Initial load (optional: show some collections even when empty query)
  useEffect(() => {
    if (disabled) return;
    // load first page with empty query so dropdown isn’t empty
    fetchCollections({ q: "", cursor: null });
  }, [disabled, fetchCollections]);

  const loadMore = useCallback(() => {
    if (!hasNext || loading) return;
    fetchCollections({ q: latestQueryRef.current, cursor: nextCursor });
  }, [fetchCollections, hasNext, loading, nextCursor]);
  const textField = (
    <Autocomplete.TextField
      label={label}
      labelHidden // 🔥 REQUIRED
      onChange={handleInputChange}
      value={inputValue}
      placeholder={placeholder}
      autoComplete="off"
      disabled={disabled}
    />
  );

  return (
    <Autocomplete
      options={options}
      selected={value ? [value] : []}
      onSelect={(selected) => {
        const id = selected?.[0] || "";
        onChange(id);
        const lbl = options.find((o) => o.value === id)?.label || "";
        setInputValue(lbl);
      }}
      textField={textField}
      loading={loading}
      willLoadMoreResults={hasNext}
      onLoadMoreResults={loadMore}
      allowMultiple={false} // ✅ ADD THIS
      emptyState={
        inputValue.trim()
          ? `No collections found for "${inputValue.trim()}".`
          : "No collections found."
      }
    />
  );
}
