import prisma from "../lib/prisma.js";
import { encodeCursor, decodeCursor } from "../utils/cursor.js";

// Pick fields to return
function pickProductFields(product) {
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

export async function listProducts(req, res) {
  try {
    const shop = req.shopId;
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 50, 100));
    const direction = req.query.direction === "prev" ? "prev" : "next";

    // Decode cursor if provided
    const decodedCursor = decodeCursor(req.query.cursor);
    const cursorId = decodedCursor?.id || undefined;

    // Build Prisma query
    const query = {
      where: { shop },
      orderBy: { id: direction === "next" ? "asc" : "desc" },
      take: limit + 1, // Fetch one extra to check hasNext
      cursor: cursorId ? { id: cursorId } : undefined,
      skip: cursorId ? 1 : 0, // skip cursor itself
    };

    const products = await prisma.product.findMany(query);

    const hasNext = products.length > limit;
    const items = hasNext ? products.slice(0, limit) : products;

    const first = items[0];
    const last = items[items.length - 1];

    res.json({
      items: items.map(pickProductFields),
      pageInfo: {
        hasNext,
        hasPrev: Boolean(decodedCursor),
        nextCursor: last ? encodeCursor({ id: last.id }) : null,
        prevCursor: first ? encodeCursor({ id: first.id }) : null,
      },
    });
  } catch (err) {
    console.error("❌ listProducts failed:", err);
    res.status(500).json({ error: "listProducts failed", details: err.message });
  }
}
