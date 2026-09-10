-- 004_audit_logs.sql — Journal d'activité (aucun secret n'y est stocké, cf audit.service.js)
-- company_id / user_id NULLables : événements globaux (super admin) ou login échoué (utilisateur inconnu).

CREATE TABLE IF NOT EXISTS activity_logs (
  id          BIGSERIAL PRIMARY KEY,
  company_id  INTEGER NULL REFERENCES companies(id) ON DELETE SET NULL,
  user_id     INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NULL,
  entity_id   TEXT NULL,
  metadata    JSONB NULL,
  ip_address  VARCHAR(64) NULL,
  user_agent  VARCHAR(512) NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_logs_company_idx ON activity_logs (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_user_idx ON activity_logs (user_id);
CREATE INDEX IF NOT EXISTS activity_logs_action_idx ON activity_logs (action, created_at DESC);
