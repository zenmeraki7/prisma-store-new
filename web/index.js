// @ts-check
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import serveStatic from "serve-static";

import shopify from "./shopify.js";
import PrivacyWebhookHandlers from "./privacy.js";

// API routes
import productSearchRoutes from "./routes/products.search.js";
import productSyncRoutes from "./routes/products.sync.js";

const PORT = parseInt(
  process.env.BACKEND_PORT || process.env.PORT || "3000",
  10
);

const STATIC_PATH =
  process.env.NODE_ENV === "production"
    ? join(process.cwd(), "web/frontend/dist")
    : join(process.cwd(), "web/frontend");

const app = express();

/* ---------------- Shopify Auth ---------------- */

app.get(shopify.config.auth.path, shopify.auth.begin());

app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  async (req, res, next) => {
    const session = res.locals.shopify.session;

    if (session) {
      try {
        const { syncProducts } = await import(
          "./services/productSync.service.js"
        );
        await syncProducts(session);
        console.log(`✅ Products synced for ${session.shop}`);
      } catch (err) {
        console.error("❌ Product sync failed:", err);
      }
    }

    return shopify.redirectToShopifyOrAppRoot()(req, res, next);
  }
);

/* ---------------- Webhooks ---------------- */

app.post(
  shopify.config.webhooks.path,
  shopify.processWebhooks({ webhookHandlers: PrivacyWebhookHandlers })
);

/* ---------------- API Protection ---------------- */

app.use("/api", shopify.validateAuthenticatedSession());

app.use("/api/products", productSearchRoutes);
app.use("/api/products", productSyncRoutes);

/* ---------------- Security + Static ---------------- */

app.use(shopify.cspHeaders());
app.use(serveStatic(STATIC_PATH, { index: false }));

/* ---------------- Frontend Loader ---------------- */

app.use(
  "/",
  shopify.ensureInstalledOnShop(),
  async (_req, res) => {
    res
      .status(200)
      .set("Content-Type", "text/html")
      .send(
        readFileSync(join(STATIC_PATH, "index.html"), "utf8").replace(
          "%VITE_SHOPIFY_API_KEY%",
          process.env.SHOPIFY_API_KEY || ""
        )
      );
  }
);

/* ---------------- Start Server ---------------- */

app.listen(PORT, () => {
  console.log(`🚀 Shopify app running on port ${PORT}`);
  console.log(`📦 Frontend served from ${STATIC_PATH}`);
});
