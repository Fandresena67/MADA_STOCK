-- 020_notifications.sql — Centre de notifications SaaS (persistantes, tenant-scopées).
-- Lecture : company_id = tenant ; user_id NULL = société, sinon personnelle.

CREATE TABLE IF NOT EXISTS notifications (
  id          BIGSERIAL PRIMARY KEY,
  company_id  BIGINT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id     BIGINT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(32) NOT NULL CHECK (type IN (
    'STOCK_LOW', 'STOCK_OUT', 'SALE_CREATED', 'SALE_CONFIRMED',
    'PURCHASE_CONFIRMED', 'INVOICE_CREATED', 'INVOICE_PAID',
    'USER_ACTIVITY', 'SECURITY', 'SYSTEM'
  )),
  title       VARCHAR(255) NOT NULL,
  message     TEXT NOT NULL DEFAULT '',
  entity_type VARCHAR(64) NULL,
  entity_id   BIGINT NULL,
  metadata    JSONB NULL,
  read_at     TIMESTAMPTZ NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Notifications personnelles super_admin : company_id NULL + user_id renseigné.
  -- Notifications société : company_id renseigné + user_id NULL.
  CHECK (company_id IS NOT NULL OR user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS notifications_company_idx ON notifications (company_id);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx ON notifications (read_at);
CREATE INDEX IF NOT EXISTS notifications_created_idx ON notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_scope_idx ON notifications (company_id, user_id, read_at);
CREATE INDEX IF NOT EXISTS notifications_company_created_idx ON notifications (company_id, created_at DESC);
