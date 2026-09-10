-- 013_invoices.sql — Factures liées (UNIQUE sale_id : 1 facture par vente) ou autonomes.
-- product_name snapshoté : la facture reste stable si le produit est renommé.

CREATE SEQUENCE IF NOT EXISTS invoice_ref_seq;

CREATE TABLE IF NOT EXISTS invoices (
  id             SERIAL PRIMARY KEY,
  company_id     INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sale_id        INTEGER NULL REFERENCES sales(id) ON DELETE RESTRICT UNIQUE,
  customer_id    INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  user_id        INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
  invoice_number VARCHAR(32) NOT NULL,
  status         VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid', 'cancelled')),
  subtotal       BIGINT NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount       BIGINT NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax            BIGINT NOT NULL DEFAULT 0 CHECK (tax >= 0),
  total          BIGINT NOT NULL DEFAULT 0 CHECK (total >= 0),
  issued_at      TIMESTAMPTZ NULL,
  due_at         TIMESTAMPTZ NULL,
  notes          VARCHAR(1000) NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id           SERIAL PRIMARY KEY,
  invoice_id   INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id   INTEGER NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name VARCHAR(200) NOT NULL DEFAULT '',
  quantity     INTEGER NOT NULL CHECK (quantity > 0),
  unit_price   BIGINT NOT NULL CHECK (unit_price >= 0),
  discount     BIGINT NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax          BIGINT NOT NULL DEFAULT 0 CHECK (tax >= 0),
  line_total   BIGINT NOT NULL CHECK (line_total >= 0)
);

CREATE INDEX IF NOT EXISTS invoices_company_idx ON invoices (company_id);
CREATE INDEX IF NOT EXISTS invoices_company_status_idx ON invoices (company_id, status);
CREATE INDEX IF NOT EXISTS invoices_company_customer_idx ON invoices (company_id, customer_id);
CREATE INDEX IF NOT EXISTS invoices_company_date_idx ON invoices (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS invoice_items_invoice_idx ON invoice_items (invoice_id);

DROP TRIGGER IF EXISTS trg_invoices_updated ON invoices;
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON invoices
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
