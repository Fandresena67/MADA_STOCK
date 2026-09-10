-- 012_sales.sql — Ventes (même modèle que les achats, mouvements OUT à la confirmation)

CREATE SEQUENCE IF NOT EXISTS sale_ref_seq;

CREATE TABLE IF NOT EXISTS sales (
  id          SERIAL PRIMARY KEY,
  company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  user_id     INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
  status      VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  reference   VARCHAR(32) NOT NULL,
  subtotal    BIGINT NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount    BIGINT NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax         BIGINT NOT NULL DEFAULT 0 CHECK (tax >= 0),
  total       BIGINT NOT NULL DEFAULT 0 CHECK (total >= 0),
  notes       VARCHAR(1000) NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, reference)
);

CREATE TABLE IF NOT EXISTS sale_items (
  id          SERIAL PRIMARY KEY,
  sale_id     INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  unit_price  BIGINT NOT NULL CHECK (unit_price >= 0),
  discount    BIGINT NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax         BIGINT NOT NULL DEFAULT 0 CHECK (tax >= 0),
  line_total  BIGINT NOT NULL CHECK (line_total >= 0)
);

CREATE INDEX IF NOT EXISTS sales_company_idx ON sales (company_id);
CREATE INDEX IF NOT EXISTS sales_company_status_idx ON sales (company_id, status);
CREATE INDEX IF NOT EXISTS sales_company_customer_idx ON sales (company_id, customer_id);
CREATE INDEX IF NOT EXISTS sales_company_date_idx ON sales (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sale_items_sale_idx ON sale_items (sale_id);
CREATE INDEX IF NOT EXISTS sale_items_product_idx ON sale_items (product_id);

DROP TRIGGER IF EXISTS trg_sales_updated ON sales;
CREATE TRIGGER trg_sales_updated BEFORE UPDATE ON sales
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
