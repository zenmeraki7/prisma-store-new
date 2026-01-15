import prisma from "../lib/prisma.js";
import { dslToPrismaWhere } from "../services/filterCompiler.js"; // your Prisma DSL -> where converter
import { encodeCursor, decodeCursor } from "../utils/cursor.js";

const SORT_FIELD = "id"; // Prisma primary key

function pickFields(product) {
  return {
    id: product.id,
    shop: product.shop,
    title: product.title,
    status: product.status,
    vendor: product.vendor,
    image: product.image,
    createdAt: product.createdAt,
  };
}

export async function queryProducts(req, res) {
  try {
    const shop = req.shopId;
    const limit = Math.min(Number(req.body?.limit || 50), 100);
    const direction = req.body?.direction === "prev" ? "prev" : "next";
    const cursor = typeof req.body?.cursor === "string" ? req.body.cursor : null;
    const filterDsl = req.body?.filter || null;

    // Prisma cursor
    const decoded = decodeCursor(cursor);
    const cursorId = decoded?.id || undefined;

    // Base where condition
    let where = { shop };

    // Merge filters if provided
    if (filterDsl) {
      const filterWhere = dslToPrismaWhere(filterDsl);
      where = { AND: [where, filterWhere] };
    }

    // Determine order
    const orderBy = { [SORT_FIELD]: direction === "next" ? "asc" : "desc" };

    // Fetch products
    const products = await prisma.product.findMany({
      where,
      orderBy,
      take: limit + 1,
      cursor: cursorId ? { id: cursorId } : undefined,
      skip: cursorId ? 1 : 0,
    });

    const hasExtra = products.length > limit;
    const pageDocs = hasExtra ? products.slice(0, limit) : products;

    const first = pageDocs[0];
    const last = pageDocs[pageDocs.length - 1];

    res.json({
      items: pageDocs.map(pickFields),
      pageInfo: {
        hasNextPage: direction === "next" && hasExtra,
        hasPreviousPage: direction === "prev" && hasExtra,
        endCursor: last ? encodeCursor({ id: last.id }) : null,
        startCursor: first ? encodeCursor({ id: first.id }) : null,
      },
      matchedCount: await prisma.product.count({ where }),
    });
  } catch (err) {
    console.error("❌ queryProducts failed:", err);
    res.status(500).json({ error: "queryProducts failed", details: err.message });
  }
}
