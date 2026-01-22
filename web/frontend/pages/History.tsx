import React from "react";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Badge,
  Text,
  BlockStack,
} from "@shopify/polaris";

type JobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

type BulkJob = {
  id: string;
  createdAt: string;
  filterSummary: string;
  mutationSummary: string;
  affectedCount: number;
  status: JobStatus;
};

const DUMMY_JOBS: BulkJob[] = [
  {
    id: "JOB-2025-0001",
    createdAt: "2025-01-01 10:02",
    filterSummary: 'product_status = "ACTIVE" AND variant_price < 10',
    mutationSummary: "Set compare_at_price to 19.99",
    affectedCount: 1423,
    status: "COMPLETED",
  },
  {
    id: "JOB-2025-0002",
    createdAt: "2025-01-02 15:37",
    filterSummary: 'variant_inventory_quantity = 0',
    mutationSummary: "Unpublish products",
    affectedCount: 213,
    status: "FAILED",
  },
  {
    id: "JOB-2025-0003",
    createdAt: "2025-01-03 09:10",
    filterSummary: "Snapshot: all T-Shirts",
    mutationSummary: "Add tag bulk-edited-jan",
    affectedCount: 980,
    status: "RUNNING",
  },
];

function statusBadge(status: JobStatus) {
  switch (status) {
    case "COMPLETED":
      return <Badge tone="success">Completed</Badge>;
    case "FAILED":
      return <Badge tone="critical">Failed</Badge>;
    case "RUNNING":
      return <Badge tone="attention">Running</Badge>;
    case "PENDING":
    default:
      return <Badge tone="info">Pending</Badge>;
  }
}

export default function HistoryPage() {
  const rows = DUMMY_JOBS.map((job) => [
    job.id,
    job.createdAt,
    job.filterSummary,
    job.mutationSummary,
    job.affectedCount.toLocaleString(),
    statusBadge(job.status),
  ]);

  return (
    <Page title="History" subtitle="Track bulk jobs and their outcomes">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                Recent bulk jobs
              </Text>

              <DataTable
                columnContentTypes={[
                  "text",
                  "text",
                  "text",
                  "text",
                  "numeric",
                  "text",
                ]}
                headings={[
                  "Job ID",
                  "Created at",
                  "Filter",
                  "Mutation",
                  "Affected",
                  "Status",
                ]}
                rows={rows}
              />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}