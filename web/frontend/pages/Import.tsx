import React from "react";
import {
  Page,
  Layout,
  Card,
  DropZone,
  Text,
  Badge,
  DataTable,
  BlockStack,
} from "@shopify/polaris";

type ImportStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

type ImportJob = {
  id: string;
  fileName: string;
  createdAt: string;
  rows: number;
  status: ImportStatus;
};

const DUMMY_IMPORTS: ImportJob[] = [
  {
    id: "IMP-001",
    fileName: "price-updates-dec.csv",
    createdAt: "2024-12-31 18:01",
    rows: 1200,
    status: "COMPLETED",
  },
  {
    id: "IMP-002",
    fileName: "bad-handle-import.csv",
    createdAt: "2025-01-02 11:20",
    rows: 320,
    status: "FAILED",
  },
  {
    id: "IMP-003",
    fileName: "inventory-sync.csv",
    createdAt: "2025-01-03 07:45",
    rows: 5400,
    status: "PROCESSING",
  },
];

function importStatusBadge(status: ImportStatus) {
  switch (status) {
    case "COMPLETED":
      return <Badge tone="success">Completed</Badge>;
    case "FAILED":
      return <Badge tone="critical">Failed</Badge>;
    case "PROCESSING":
      return <Badge tone="attention">Processing</Badge>;
    case "PENDING":
    default:
      return <Badge tone="info">Pending</Badge>;
  }
}

export default function ImportPage() {
  const [files, setFiles] = React.useState<File[]>([]);

  const handleDropZoneDrop = React.useCallback(
    (_dropFiles: File[], acceptedFiles: File[]) => {
      setFiles((prev) => [...prev, ...acceptedFiles]);
    },
    [],
  );

  const rows = DUMMY_IMPORTS.map((imp) => [
    imp.id,
    imp.fileName,
    imp.createdAt,
    imp.rows.toLocaleString(),
    importStatusBadge(imp.status),
  ]);

  return (
    <Page title="Import" subtitle="Upload CSVs and turn them into bulk jobs">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  Upload CSV
                </Text>
                <Text as="p" variant="bodyMd">
                  Drop a CSV of product or variant updates. This will validate
                  headers and generate a preview.
                </Text>
              </BlockStack>

              <DropZone accept=".csv" type="file" onDrop={handleDropZoneDrop}>
                <DropZone.FileUpload />
              </DropZone>

              {files.length > 0 && (
                <BlockStack gap="100">
                  <Text as="h3" variant="headingSm">
                    Pending uploads
                  </Text>
                  {files.map((file) => (
                    <Text as="p" key={file.name}>
                      {file.name}
                    </Text>
                  ))}
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                Recent imports
              </Text>

              <DataTable
                columnContentTypes={["text", "text", "text", "numeric", "text"]}
                headings={["ID", "File", "Created at", "Rows", "Status"]}
                rows={rows}
              />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
