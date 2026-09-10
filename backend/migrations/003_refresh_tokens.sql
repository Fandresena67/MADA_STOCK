-- 003_refresh_tokens.sql — Sessions : rotation + révocation + reuse detection
-- IMPORTANT : seul le hash SHA-256 du refresh token est stocké. JAMAIS le token brut.

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id                   SERIAL PRIMARY KEY,
  user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash           CHAR(64) NOT NULL UNIQUE,
  expires_at           TIMESTAMPTZ NOT NULL,
  revoked_at           TIMESTAMPTZ NULL,
  replaced_by_token_id INTEGER NULL REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  user_agent           VARCHAR(512) NULL,
  ip_address           VARCHAR(64) NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_expires_idx ON refresh_tokens (expires_at);
