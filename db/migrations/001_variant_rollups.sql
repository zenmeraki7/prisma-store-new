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

CREATE TABLE IF NOT EXISTS variant_rollups (
  shop_id TEXT NOT NULL,
  product_id BIGINT NOT NULL,

  variant_count INTEGER NOT NULL DEFAULT 0,
  total_inventory INTEGER NOT NULL DEFAULT 0,
  min_price NUMERIC(20,2),
  max_price NUMERIC(20,2),
  in_stock BOOLEAN NOT NULL DEFAULT FALSE,

  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  PRIMARY KEY (shop_id, product_id)
);
