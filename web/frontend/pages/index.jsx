import {
  Card,
  Page,
  Layout,
  TextContainer,
  Image,
  Link,
  Text,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useTranslation, Trans } from "react-i18next";
import SessionDashboard from "../components/SessionDashboard";

export default function HomePage() {
  const { t } = useTranslation();
  return (
    <Page narrowWidth>
      <TitleBar title={t("HomePage.title")} />
      <Layout>
      
        <SessionDashboard />
      </Layout>
    </Page>
  );
}
