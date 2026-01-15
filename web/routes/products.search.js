import express from "express";
import prisma from "../../lib/prisma.js";
import { dslToPrismaWhere } from "../utils/dslToPrisma.js";
import { authenticate } from "../shopify/auth.js";

const router = express.Router();

router.post("/search", authenticate, async (req, res) => {
  const { limit = 50, cursor, filter } = req.body;
  const shop = res.locals.shopify.session.shop;

  const where = {
    shop,
    ...dslToPrismaWhere(filter),
  };

  const items = await prisma.product.findMany({
    where,
    orderBy: { id: "asc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  res.json({
    items: items.slice(0, limit),
    pageInfo: {
      endCursor: items.at(-1)?.id ?? null,
      hasNextPage: items.length > limit,
    },
  });
});

export default router;
