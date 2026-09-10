-- 010_customers.sql — Clients tenant-scopés (soft disable, pas de delete si utilisé)

CREATE TABLE IF NOT EXISTS customers (
  id          SERIAL PRIMARY KEY,
  company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        VARCHAR(200) NOT NULL,
  email       VARCHAR(255) NOT NULL DEFAULT '',
  phone       VARCHAR(64) NOT NULL DEFAULT '',
  address     VARCHAR(500) NOT NULL DEFAULT '',
  notes       VARCHAR(1000) NOT NULL DEFAULT '',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS customers_company_idx ON customers (company_id);
CREATE INDEX IF NOT EXISTS customers_company_active_idx ON customers (company_id, is_active);
CREATE INDEX IF NOT EXISTS customers_search_idx ON customers (company_id, lower(name));

DROP TRIGGER IF EXISTS trg_customers_updated ON customers;
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
