import { BillingInterval } from "@shopify/shopify-api";
import { shopifyApp } from "@shopify/shopify-app-express";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "../lib/prisma.server.js";

const shopify = shopifyApp({
  api: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    apiVersion: "2024-10", // ✅ FIX
    scopes: process.env.SCOPES?.split(","),
    hostName: process.env.HOST.replace(/^https?:\/\//, ""),
  },
  sessionStorage: new PrismaSessionStorage(prisma),
});

export default shopify;
