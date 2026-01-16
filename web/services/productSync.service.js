import prisma from "../../lib/prisma.js";
import { fetchAllProducts } from "../routes/shopifyproducts.js";

export async function syncProducts(session) {
  console.log("🔄 Starting product sync");
  console.log("🏪 Shop:", session.shop);

  const products = await fetchAllProducts(session);

  console.log(`📦 Shopify returned ${products.length} products`);

  let upserted = 0;

  for (const p of products) {
    await prisma.product.upsert({
      where: {
        shop_id: {
          shop: session.shop,
          id: String(p.id),
        },
      },
      update: {
        title: p.title,
        status: p.status,
        vendor: p.vendor,
        image: p.image?.src ?? null,
      },
      create: {
        shop: session.shop,
        id: String(p.id),
        title: p.title,
        status: p.status,
        vendor: p.vendor,
        image: p.image?.src ?? null,
      },
    });

    upserted++;
  }

  console.log(`✅ Synced ${upserted} products for ${session.shop}`);
}
