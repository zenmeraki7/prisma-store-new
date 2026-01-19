// api/products.route.ts
import express from "express";
import prisma from "../../lib/prisma.js";
import { compileFilterToPrisma } from "../services/prismaFilterCompiler";

const router = express.Router();

router.post("/search", async (req, res) => {
  try {
    const {
      limit = 25,
      cursor,
      filter,
    } = req.body;

    const where = compileFilterToPrisma(filter);

    const items = await prisma.product.findMany({
      where,
      take: limit + 1,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
      orderBy: { id: "asc" },
      include: {
        rollup: true,
      },
    });

    const hasNextPage = items.length > limit;
    const sliced = hasNextPage ? items.slice(0, limit) : items;

    res.json({
      items: sliced,
      pageInfo: {
        hasNextPage,
        endCursor:
          sliced.length > 0
            ? sliced[sliced.length - 1].id
            : null,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
