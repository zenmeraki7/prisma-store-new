import { BillingInterval, ApiVersion } from "@shopify/shopify-api";
import { shopifyApp } from "@shopify/shopify-app-express";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-10";
import prisma from "../lib/prisma.server.js";

const shopify = shopifyApp({
  api: {
    apiVersion: ApiVersion.October24,
    restResources,
    future: {
      customerAddressDefaultFix: true,
      lineItemBilling: true,
      unstable_managedPricingSupport: true,
    },
    billing: undefined,
  },
  auth: {
    path: "/api/auth",
    callbackPath: "/api/auth/callback",
  },
  webhooks: {
    path: "/api/webhooks",
  },

  // ✅ PRISMA SESSION STORAGE (Supabase)
  sessionStorage: new PrismaSessionStorage(prisma),
});

export default shopify;
