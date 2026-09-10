-- 011_purchases.sql — Achats (draft → confirmed → historique immuable ; cancel = draft uniquement)
-- Montants BIGINT (Ariary). Références via séquence (concurrence-safe, jamais COUNT+1).

CREATE SEQUENCE IF NOT EXISTS purchase_ref_seq;

CREATE TABLE IF NOT EXISTS purchases (
  id          SERIAL PRIMARY KEY,
  company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
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

CREATE TABLE IF NOT EXISTS purchase_items (
  id          SERIAL PRIMARY KEY,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  unit_price  BIGINT NOT NULL CHECK (unit_price >= 0),
  discount    BIGINT NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax         BIGINT NOT NULL DEFAULT 0 CHECK (tax >= 0),
  line_total  BIGINT NOT NULL CHECK (line_total >= 0)
);

CREATE INDEX IF NOT EXISTS purchases_company_idx ON purchases (company_id);
CREATE INDEX IF NOT EXISTS purchases_company_status_idx ON purchases (company_id, status);
CREATE INDEX IF NOT EXISTS purchases_company_supplier_idx ON purchases (company_id, supplier_id);
CREATE INDEX IF NOT EXISTS purchases_company_date_idx ON purchases (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS purchase_items_purchase_idx ON purchase_items (purchase_id);
CREATE INDEX IF NOT EXISTS purchase_items_product_idx ON purchase_items (product_id);

DROP TRIGGER IF EXISTS trg_purchases_updated ON purchases;
CREATE TRIGGER trg_purchases_updated BEFORE UPDATE ON purchases
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
