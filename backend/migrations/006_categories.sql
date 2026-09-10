-- 006_categories.sql — Catégories tenant-scopées (nom unique par entreprise, insensible à la casse)

CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        VARCHAR(120) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS categories_company_idx ON categories (company_id);
CREATE INDEX IF NOT EXISTS categories_company_active_idx ON categories (company_id, is_active);
-- Unicité du nom par entreprise, insensible à la casse (2 entreprises peuvent partager un nom).
CREATE UNIQUE INDEX IF NOT EXISTS categories_company_name_unique ON categories (company_id, lower(name));

DROP TRIGGER IF EXISTS trg_categories_updated ON categories;
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
