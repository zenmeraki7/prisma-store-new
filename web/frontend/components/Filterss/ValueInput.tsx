import { TextField, Select, InlineStack } from "@shopify/polaris";

import { TagPicker } from "./pickers/TagPicker";
import { CollectionPicker } from "./pickers/CollectionPicker";
import { MetafieldKeyPicker } from "./pickers/MetafieldKeyPicker";

/* ---------------- types ---------------- */

type Props = {
  type: "text" | "number" | "date" | "enum" | "range";
  operator: string;
  picker?: "status" | "tag" | "collection" | "metafield";
  value: any;
  onChange: (v: any) => void;
};

/* ---------------- component ---------------- */

export function ValueInput({ type, operator, picker, value, onChange }: Props) {
  /* ---------- operators that need NO value ---------- */
  if (operator === "is_blank" || operator === "is_not_blank") {
    return null;
  }

  /* ---------------- picker based ---------------- */

  if (picker === "status") {
    return (
      <Select
        label="Status"
        labelHidden
        multiple
        options={[
          { label: "Active", value: "ACTIVE" },
          { label: "Draft", value: "DRAFT" },
          { label: "Archived", value: "ARCHIVED" },
        ]}
        value={value ?? []}
        onChange={onChange}
      />
    );
  }

  if (picker === "tag") {
    return <TagPicker value={value ?? []} onChange={onChange} />;
  }

  if (picker === "collection") {
    return (
      <CollectionPicker value={value ?? ""} onChange={(id) => onChange(id)} />
    );
  }

  if (picker === "metafield") {
    return <MetafieldKeyPicker value={value} onChange={onChange} />;
  }

  /* ---------------- type based ---------------- */

  switch (type) {
    case "text":
      return (
        <TextField
          label="Value"
          labelHidden
          value={value ?? ""}
          onChange={onChange}
          autoComplete="off"
        />
      );

    case "number":
      return (
        <TextField
          label="Value"
          labelHidden
          type="number"
          value={value ?? ""}
          onChange={(v) => onChange(v === "" ? null : Number(v))}
        />
      );

    case "date":
      return (
        <TextField
          label="Date"
          labelHidden
          type="date"
          value={value ?? ""}
          onChange={onChange}
        />
      );

    case "range":
      return (
        <InlineStack gap="200">
          <TextField
            label="Min"
            labelHidden
            type="number"
            placeholder="Min"
            value={value?.min ?? ""}
            onChange={(v) =>
              onChange({
                ...value,
                min: v === "" ? null : Number(v),
              })
            }
          />
          <TextField
            label="Max"
            labelHidden
            type="number"
            placeholder="Max"
            value={value?.max ?? ""}
            onChange={(v) =>
              onChange({
                ...value,
                max: v === "" ? null : Number(v),
              })
            }
          />
        </InlineStack>
      );

    case "enum":
      return (
        <Select
          label="Value"
          labelHidden
          options={[]}
          value={value}
          onChange={onChange}
        />
      );

    default:
      return null;
  }
}
