import React from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  ChoiceList,
  Checkbox,
  TextField,
  Button,
  InlineStack,
  BlockStack,
} from "@shopify/polaris";

export default function SettingsPage() {
  const [plan, setPlan] = React.useState<string[]>(["pro"]);
  const [nightlySnapshot, setNightlySnapshot] = React.useState(true);
  const [enableFastPlane, setEnableFastPlane] = React.useState(true);
  const [supportEmail, setSupportEmail] = React.useState(
    "support@zenmeraki.com",
  );

  const handleSave = () => {
    console.log("Saving settings", {
      plan,
      nightlySnapshot,
      enableFastPlane,
      supportEmail,
    });
  };

  return (
    <Page
      title="Settings"
      subtitle="Control how the Ablestar-killer behaves for this shop"
      primaryAction={{ content: "Save", onAction: handleSave }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              {/* Plan */}
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Plan
                </Text>

                <Text as="p" variant="bodyMd">
                  Choose the internal plan for this shop. This does not affect
                  Shopify billing in this demo; it only toggles feature flags.
                </Text>

                <ChoiceList
                  title="Plan"
                  titleHidden
                  choices={[
                    { label: "Free", value: "free" },
                    { label: "Pro", value: "pro" },
                    { label: "Enterprise", value: "enterprise" },
                  ]}
                  selected={plan}
                  onChange={setPlan}
                />
              </BlockStack>

              {/* Performance */}
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Performance & snapshotting
                </Text>

                <Checkbox
                  label="Enable FAST plane for supported filters"
                  checked={enableFastPlane}
                  onChange={setEnableFastPlane}
                />

                <Checkbox
                  label="Run nightly snapshot refresh"
                  checked={nightlySnapshot}
                  onChange={setNightlySnapshot}
                />

                <Text as="p" variant="bodySm">
                  In the real implementation this controls background jobs that
                  rebuild product rollups and snapshot sets.
                </Text>
              </BlockStack>

              {/* Support */}
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Support
                </Text>

                <InlineStack gap="400" align="start" blockAlign="center">
                  <TextField
                    label="Support email"
                    labelHidden
                    value={supportEmail}
                    onChange={setSupportEmail}
                    autoComplete="email"
                  />

                  <Button
                    onClick={() =>
                      window.open(
                        `mailto:${supportEmail}?subject=Bulk editor support`,
                      )
                    }
                  >
                    Send test email
                  </Button>
                </InlineStack>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
