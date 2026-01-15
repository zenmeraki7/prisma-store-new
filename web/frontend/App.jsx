import { HashRouter } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NavMenu } from "@shopify/app-bridge-react";
import Routes from "./Routes";
import { QueryProvider, PolarisProvider } from "./components";

export default function App() {
  const pages = import.meta.glob(
    "./pages/**/!(*.test.[jt]sx)*.([jt]sx)",
    { eager: true }
  );

  const { t } = useTranslation();

  return (
    <PolarisProvider>
      <HashRouter>
        <QueryProvider>
          <NavMenu>
            <a href="#/" rel="home" />
            <a href="#/Products">{t("NavigationMenu.Products")}</a>

          </NavMenu>

          <Routes pages={pages} />
        </QueryProvider>
      </HashRouter>
    </PolarisProvider>
  );
}
