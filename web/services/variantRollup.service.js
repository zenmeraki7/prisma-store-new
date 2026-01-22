import prisma from "../../lib/prisma.js";

export async function refreshVariantRollups(shop) {
  await prisma.$executeRaw`
    INSERT INTO variant_rollups (
      shop,
      product_id,
      variant_count,
      total_inventory,
      min_price,
      max_price,
      in_stock
    )
    SELECT
      p.shop,
      p.id,
      COUNT(v.id),
      COALESCE(SUM(v.inventory_quantity), 0),
      MIN(v.price),
      MAX(v.price),
      BOOL_OR(v.inventory_quantity > 0)
    FROM products p
    LEFT JOIN variants v ON v.product_id = p.id
    WHERE p.shop = ${shop}
    GROUP BY p.shop, p.id
    ON CONFLICT (shop, product_id)
    DO UPDATE SET
      variant_count   = EXCLUDED.variant_count,
      total_inventory = EXCLUDED.total_inventory,
      min_price       = EXCLUDED.min_price,
      max_price       = EXCLUDED.max_price,
      in_stock        = EXCLUDED.in_stock,
      updated_at      = NOW();
  `;
}
