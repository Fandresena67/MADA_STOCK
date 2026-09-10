-- 008_stock_movements.sql — Journal officiel immuable des variations de stock.
-- user_id NULLABLE avec SET NULL : l'historique survit à la suppression d'un utilisateur
-- (colonne toujours renseignée par l'application). product_id RESTRICT : jamais de
-- suppression physique d'un produit mouvementé (soft delete applicatif de toute façon).

CREATE TABLE IF NOT EXISTS stock_movements (
  id               SERIAL PRIMARY KEY,
  company_id       INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id       INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  user_id          INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
  movement_type    VARCHAR(16) NOT NULL CHECK (movement_type IN ('initial', 'in', 'out', 'adjustment')),
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  quantity_before  INTEGER NOT NULL CHECK (quantity_before >= 0),
  quantity_after   INTEGER NOT NULL CHECK (quantity_after >= 0),
  reason           VARCHAR(200) NOT NULL DEFAULT '',
  reference        VARCHAR(64) NOT NULL DEFAULT '',
  notes            VARCHAR(1000) NOT NULL DEFAULT '',
  idempotency_key  VARCHAR(64) NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT stock_movements_idempotency_unique UNIQUE (company_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS stock_movements_company_idx ON stock_movements (company_id);
CREATE INDEX IF NOT EXISTS stock_movements_company_date_idx ON stock_movements (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON stock_movements (company_id, product_id, id DESC);
CREATE INDEX IF NOT EXISTS stock_movements_type_idx ON stock_movements (company_id, movement_type);
CREATE INDEX IF NOT EXISTS stock_movements_user_idx ON stock_movements (company_id, user_id);
