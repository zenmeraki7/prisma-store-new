import React from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  DataTable,
  TextField,
  Button,
  BlockStack,
} from "@shopify/polaris";

type SpreadsheetRow = {
  id: string;
  productTitle: string;
  variantTitle: string;
  sku: string;
  price: string;
  compareAtPrice: string;
};

const INITIAL_ROWS: SpreadsheetRow[] = [
  {
    id: "var-1",
    productTitle: "Ablestar Slayer Tee",
    variantTitle: "Black / M",
    sku: "ABL-TEE-BLK-M",
    price: "19.99",
    compareAtPrice: "29.99",
  },
  {
    id: "var-2",
    productTitle: "Ablestar Slayer Tee",
    variantTitle: "Black / L",
    sku: "ABL-TEE-BLK-L",
    price: "19.99",
    compareAtPrice: "29.99",
  },
  {
    id: "var-3",
    productTitle: "Fast Plane Cap",
    variantTitle: "One Size",
    sku: "FAST-CAP-OS",
    price: "14.99",
    compareAtPrice: "",
  },
];

export default function SpreadsheetEditPage() {
  const [rows, setRows] = React.useState<SpreadsheetRow[]>(INITIAL_ROWS);
  const [dirty, setDirty] = React.useState(false);

  const updateCell = (
    rowId: string,
    key: "price" | "compareAtPrice",
    value: string,
  ) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, [key]: value } : row,
      ),
    );
    setDirty(true);
  };

  const handleReset = () => {
    setRows(INITIAL_ROWS);
    setDirty(false);
  };

  const handleCommit = () => {
    console.log("Submitting spreadsheet changes", rows);
    setDirty(false);
  };

 const tableRows = rows.map((row) => [
  row.productTitle,
  row.variantTitle,
  row.sku,
  <TextField
    key={`${row.id}-price`}
    label="Price"
    labelHidden
    value={row.price}
    onChange={(value) => updateCell(row.id, "price", value)}
    autoComplete="off"
  />,
  <TextField
    key={`${row.id}-compare`}
    label="Compare at price"
    labelHidden
    value={row.compareAtPrice}
    onChange={(value) =>
      updateCell(row.id, "compareAtPrice", value)
    }
    autoComplete="off"
  />,
]);


  return (
    <Page
      title="Spreadsheet edit"
      subtitle="Inline-edit variants in a grid, then commit as a bulk job"
      primaryAction={{
        content: "Commit changes",
        disabled: !dirty,
        onAction: handleCommit,
      }}
      secondaryActions={[
        {
          content: "Reset",
          onAction: handleReset,
          disabled: !dirty,
        },
      ]}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="p" variant="bodyMd">
                This is a minimal spreadsheet-like experience. In the real app,
                this would be powered by your snapshot plane and a mutation
                preview engine.
              </Text>

              <DataTable
                columnContentTypes={[
                  "text",
                  "text",
                  "text",
                  "text",
                  "text",
                ]}
                headings={[
                  "Product",
                  "Variant",
                  "SKU",
                  "Price",
                  "Compare at price",
                ]}
                rows={tableRows}
              />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
