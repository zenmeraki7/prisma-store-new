CREATE TABLE IF NOT EXISTS product_collection (
  shop_id TEXT NOT NULL,
  product_id BIGINT NOT NULL,
  collection_id BIGINT NOT NULL,

  PRIMARY KEY (shop_id, product_id, collection_id)
);

CREATE INDEX IF NOT EXISTS idx_product_collection_shop_collection_product
  ON product_collection (shop_id, collection_id, product_id);
