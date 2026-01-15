import express from "express";
import productSearch from "./products.search.js";
import productSync from "./products.sync.js";

const router = express.Router();

router.use("/products", productSearch);
router.use("/products", productSync);

export default router;
