import express from "express";
import { syncProducts } from "../services/productSync.service.js";
import shopify from "../shopify.js";

const router = express.Router();

/**
 * POST /api/products/sync
 */
router.post(
  "/sync",
  shopify.validateAuthenticatedSession(), // ✅ REQUIRED
  async (req, res) => {
    try {
      const session = res.locals.shopify.session;

      console.log("🔐 Sync route hit for:", session.shop);

      await syncProducts(session);

      return res.json({
        success: true,
        message: "Products synced successfully",
      });
    } catch (error) {
      console.error("❌ Sync failed:", error);
      return res.status(500).json({ error: "Sync failed" });
    }
  }
);

export default router;
