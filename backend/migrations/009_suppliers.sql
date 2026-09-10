-- 009_suppliers.sql — Fournisseurs tenant-scopés (soft disable, pas de delete si utilisé)

CREATE TABLE IF NOT EXISTS suppliers (
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

CREATE INDEX IF NOT EXISTS suppliers_company_idx ON suppliers (company_id);
CREATE INDEX IF NOT EXISTS suppliers_company_active_idx ON suppliers (company_id, is_active);
CREATE INDEX IF NOT EXISTS suppliers_search_idx ON suppliers (company_id, lower(name));

DROP TRIGGER IF EXISTS trg_suppliers_updated ON suppliers;
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON suppliers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
