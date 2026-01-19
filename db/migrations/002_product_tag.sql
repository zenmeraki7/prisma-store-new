CREATE TABLE IF NOT EXISTS product_tag (
  shop_id TEXT NOT NULL,
  product_id BIGINT NOT NULL,
  tag TEXT NOT NULL,

  PRIMARY KEY (shop_id, product_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_product_tag_shop_tag_product
  ON product_tag (shop_id, tag, product_id);
