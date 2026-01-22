import prisma from "../../lib/prisma.js";
import { fetchAllProducts } from "../routes/shopifyproducts.js";

export async function syncProducts(session) {
  console.log("🔄 Starting product sync");
  console.log("🏪 Shop:", session.shop);

  const products = await fetchAllProducts(session);
  console.log(`📦 Shopify returned ${products.length} products`);

  let upserted = 0;

  for (const p of products) {
    // ---------- Product upsert ----------
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

    // ---------- Rollup calculation ----------
    const variants = p.variants ?? [];

    const variantCount = variants.length;
    const totalInventory = variants.reduce(
      (sum, v) => sum + (v.inventory_quantity ?? 0),
      0
    );

    const prices = variants
      .map(v => parseFloat(v.price))
      .filter(p => !isNaN(p));

    const minPrice = prices.length ? Math.min(...prices) : 0;
    const maxPrice = prices.length ? Math.max(...prices) : 0;

await prisma.variantRollup.upsert({
  where: {
    shop_productId: {        // ✅ CORRECT NAME
      shop: session.shop,
      productId: String(p.id),
    },
  },
  update: {
    variantCount,
    totalInventory,
    minPrice,
    maxPrice,
  },
  create: {
    shop: session.shop,
    productId: String(p.id),
    variantCount,
    totalInventory,
    minPrice,
    maxPrice,
  },
});


    upserted++;
  }

  console.log(`✅ Synced ${upserted} products for ${session.shop}`);
}
