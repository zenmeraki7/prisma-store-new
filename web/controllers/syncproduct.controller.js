import { productSyncQueue } from "../queues/productSync.queue.js";
import prisma from "../lib/prisma.js";

/**
 * Enqueues a job to sync all products from Shopify into PostgreSQL
 */
export async function syncAllProducts(req, res) {
  try {
    const session = res.locals.shopify?.session;
    const shop = session?.shop;
    const accessToken = session?.accessToken;

    if (!shop || !accessToken) {
      console.error("❌ Missing session data");
      return res.status(401).json({ error: "Unauthorized" });
    }

    // ✅ Prisma: check if shop exists in your Product table
    // If you have a separate Shop table, replace with prisma.shop.findUnique
    const shopExists = await prisma.product.findFirst({
      where: { shop },
    });

    if (!shopExists) {
      console.warn("⚠️ No products found for shop yet — continuing sync");
      // optional: you could create a Shop table if you want
    }

    // Add job to queue
    const job = await productSyncQueue.add(
      "initial-product-sync",
      {
        shop,
        accessToken,
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );

    console.log("📥 Product sync job added:", job.id);

    return res.json({
      success: true,
      jobId: job.id,
    });
  } catch (err) {
    console.error("❌ syncAllProducts failed:", err);
    return res.status(500).json({
      error: "Failed to enqueue product sync",
      details: err.message,
    });
  }
}
