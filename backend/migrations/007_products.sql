-- 007_products.sql — Produits tenant-scopés, montants BIGINT (Ariary entiers, jamais FLOAT)
-- quantity = stock actuel (mouvements détaillés = Étape 5). Soft delete via is_active.

CREATE SEQUENCE IF NOT EXISTS product_sku_seq;

CREATE TABLE IF NOT EXISTS products (
  id             SERIAL PRIMARY KEY,
  company_id     INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id    INTEGER NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name           VARCHAR(200) NOT NULL,
  sku            VARCHAR(64) NOT NULL,
  description    VARCHAR(1000) NOT NULL DEFAULT '',
  purchase_price BIGINT NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
  sale_price     BIGINT NOT NULL DEFAULT 0 CHECK (sale_price >= 0),
  quantity       INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_stock      INTEGER NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  unit           VARCHAR(32) NOT NULL DEFAULT 'unité',
  barcode        VARCHAR(64) NULL,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- SKU unique par entreprise (2 entreprises peuvent partager un SKU).
  UNIQUE (company_id, sku)
);

CREATE INDEX IF NOT EXISTS products_company_idx ON products (company_id);
CREATE INDEX IF NOT EXISTS products_company_active_idx ON products (company_id, is_active);
CREATE INDEX IF NOT EXISTS products_company_category_idx ON products (company_id, category_id);
-- Recherche insensible à la casse (nom). Unicité barcode via la contrainte UNIQUE
-- (company_id, barcode) — NULL autorisés et non comparés entre eux sous PostgreSQL.
CREATE INDEX IF NOT EXISTS products_search_idx ON products (company_id, lower(name));

DROP TRIGGER IF EXISTS trg_products_updated ON products;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
