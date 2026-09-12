-- 023_companies_identity.sql — Identité entreprise pour facturation (tout optionnel).
-- Rétrocompatible : colonnes NULLABLE, aucune obligation nouvelle.

ALTER TABLE companies ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255) NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS website VARCHAR(255) NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tax_id VARCHAR(64) NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS stat_number VARCHAR(64) NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS rcs_number VARCHAR(64) NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS payment_info VARCHAR(1000) NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(500) NULL;
