import prisma from "../../lib/prisma.js";
import { fetchAllProducts } from "../routes/shopifyproducts.js";

export async function syncProducts(session) {
  const products = await fetchAllProducts(session);

  for (const p of products) {
    await prisma.product.upsert({
      where: { id: String(p.id) },
      update: {
        title: p.title,
        status: p.status,
        vendor: p.vendor,
        image: p.image?.src,
      },
      create: {
        id: String(p.id),
        shop: session.shop,
        title: p.title,
        status: p.status,
        vendor: p.vendor,
        image: p.image?.src,
      },
    });
  }
}
