CREATE TABLE IF NOT EXISTS variant_rollups (
  shop_id TEXT NOT NULL,
  product_id BIGINT NOT NULL,

  variant_count INTEGER NOT NULL DEFAULT 0,
  total_inventory INTEGER NOT NULL DEFAULT 0,
  min_price NUMERIC(20,2) NOT NULL DEFAULT 0,
  max_price NUMERIC(20,2) NOT NULL DEFAULT 0,
  in_stock BOOLEAN NOT NULL DEFAULT FALSE,

  PRIMARY KEY (shop_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_variant_rollups_shop_variant_count_product
  ON variant_rollups (shop_id, variant_count, product_id);

CREATE INDEX IF NOT EXISTS idx_variant_rollups_shop_total_inventory_product
  ON variant_rollups (shop_id, total_inventory, product_id);

CREATE INDEX IF NOT EXISTS idx_variant_rollups_shop_min_price_product
  ON variant_rollups (shop_id, min_price, product_id);

CREATE INDEX IF NOT EXISTS idx_variant_rollups_shop_max_price_product
  ON variant_rollups (shop_id, max_price, product_id);

CREATE INDEX IF NOT EXISTS idx_variant_rollups_shop_in_stock_product
  ON
