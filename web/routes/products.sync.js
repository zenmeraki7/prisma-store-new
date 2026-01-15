// backend/routes/products.sync.js
import express from "express";
import { syncProducts } from "../services/productSync.service.js"; 

const router = express.Router();

/**
 * POST /api/products/sync
 * Syncs all products from Shopify into your database
 */
router.post("/sync", async (req, res) => {
  try {
      const session = res.locals.shopify.session; 
    if (!session) {
      return res.status(401).json({ error: "Unauthorized: missing session" });
    }

    await syncProducts(session);

    return res.status(200).json({ success: true, message: "Products synced successfully." });
  } catch (error) {
    console.error("Error syncing products:", error);
    return res.status(500).json({ error: "Failed to sync products." });
  }
});

export default router;
