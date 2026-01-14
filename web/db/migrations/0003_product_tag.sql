-- web/db/migrations/0003_product_tag.sql
-- Product ↔ Tag join (FAST filtering)

BEGIN;

CREATE TABLE IF NOT EXISTS product_tag (
  shop_id     TEXT NOT NULL,
  product_id  BIGINT NOT NULL,
  tag         TEXT NOT NULL,

  PRIMARY KEY (shop_id, product_id, tag),

  CONSTRAINT fk_product_tag_product
    FOREIGN KEY (shop_id, product_id)
    REFERENCES product_lite (shop_id, product_id)
    ON DELETE CASCADE
);

-- Required by registry: product_tag(shop_id, tag, product_id)
-- Supports EXISTS/NOT EXISTS membership checks with tag = ANY($n)
CREATE INDEX IF NOT EXISTS idx_product_tag_shop_tag_product
  ON product_tag (shop_id, tag, product_id);

-- Optional: helps DELETE bursts during replace-set tag sync (PK often sufficient)
CREATE INDEX IF NOT EXISTS idx_product_tag_shop_product
  ON product_tag (shop_id, product_id);

COMMIT;
