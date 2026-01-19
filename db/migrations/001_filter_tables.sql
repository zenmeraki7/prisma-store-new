BEGIN;

CREATE TABLE IF NOT EXISTS product_lite (
  shop_id TEXT NOT NULL,
  product_id TEXT NOT NULL,

  status TEXT NOT NULL,
  vendor TEXT,
  title TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),

  PRIMARY KEY (shop_id, product_id)
);

CREATE TABLE IF NOT EXISTS variant_rollups (
  shop_id TEXT NOT NULL,
  product_id TEXT NOT NULL,

  variant_count INTEGER NOT NULL DEFAULT 0,
  total_inventory INTEGER NOT NULL DEFAULT 0,
  min_price NUMERIC(10,2),
  max_price NUMERIC(10,2),
  in_stock BOOLEAN NOT NULL DEFAULT false,

  PRIMARY KEY (shop_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_lite_vendor
  ON product_lite (shop_id, vendor);

CREATE INDEX IF NOT EXISTS idx_variant_rollups_price
  ON variant_rollups (shop_id, min_price, max_price);

CREATE INDEX IF NOT EXISTS idx_variant_rollups_stock
  ON variant_rollups (shop_id, in_stock);

COMMIT;
