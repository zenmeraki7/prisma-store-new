-- web/db/migrations/0004_product_collection.sql
-- Product ↔ Collection join (FAST filtering)

BEGIN;

CREATE TABLE IF NOT EXISTS product_collection (
  shop_id        TEXT NOT NULL,
  product_id     BIGINT NOT NULL,
  collection_id  BIGINT NOT NULL,  -- numeric collection ID

  PRIMARY KEY (shop_id, product_id, collection_id),

  CONSTRAINT fk_product_collection_product
    FOREIGN KEY (shop_id, product_id)
    REFERENCES product_lite (shop_id, product_id)
    ON DELETE CASCADE
);

-- Required by registry: product_collection(shop_id, collection_id, product_id)
CREATE INDEX IF NOT EXISTS idx_product_collection_shop_collection_product
  ON product_collection (shop_id, collection_id, product_id);

-- Optional: helps DELETE bursts during replace-set collection sync (PK often sufficient)
CREATE INDEX IF NOT EXISTS idx_product_collection_shop_product
  ON product_collection (shop_id, product_id);

COMMIT;
