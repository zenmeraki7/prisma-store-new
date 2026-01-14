-- web/db/migrations/0002_variant_rollups.sql
-- Aggregated variant data (inventory + price) for FAST filtering
--
-- Supports FAST registry filters:
-- - product.variantCount
-- - product.inventoryQuantity
-- - variant.priceMin / variant.priceMax
-- - variant.inStock

BEGIN;

CREATE TABLE IF NOT EXISTS variant_rollups (
  shop_id           TEXT NOT NULL,
  product_id        BIGINT NOT NULL,

  variant_count     INTEGER NOT NULL DEFAULT 0,
  total_inventory   INTEGER NOT NULL DEFAULT 0,
  min_price         NUMERIC(20, 2) NOT NULL DEFAULT 0,
  max_price         NUMERIC(20, 2) NOT NULL DEFAULT 0,
  in_stock          BOOLEAN NOT NULL DEFAULT FALSE,

  PRIMARY KEY (shop_id, product_id),

  CONSTRAINT fk_variant_rollups_product
    FOREIGN KEY (shop_id, product_id)
    REFERENCES product_lite (shop_id, product_id)
    ON DELETE CASCADE
);

-- Baseline join efficiency (PK covers this, but explicit index can help planners)
CREATE INDEX IF NOT EXISTS idx_variant_rollups_shop_product
  ON variant_rollups (shop_id, product_id);

-- Required indexes by registry (end with product_id for paging-friendly plans)
CREATE INDEX IF NOT EXISTS idx_variant_rollups_shop_variant_count_product
  ON variant_rollups (shop_id, variant_count, product_id);

CREATE INDEX IF NOT EXISTS idx_variant_rollups_shop_total_inventory_product
  ON variant_rollups (shop_id, total_inventory, product_id);

CREATE INDEX IF NOT EXISTS idx_variant_rollups_shop_min_price_product
  ON variant_rollups (shop_id, min_price, product_id);

CREATE INDEX IF NOT EXISTS idx_variant_rollups_shop_max_price_product
  ON variant_rollups (shop_id, max_price, product_id);

CREATE INDEX IF NOT EXISTS idx_variant_rollups_shop_in_stock_product
  ON variant_rollups (shop_id, in_stock, product_id);

-- Optional partial: accelerates in_stock=true scans when true is selective
CREATE INDEX IF NOT EXISTS idx_variant_rollups_shop_in_stock_true_product
  ON variant_rollups (shop_id, product_id)
  WHERE in_stock = TRUE;

COMMIT;
