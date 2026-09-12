-- 026_companies_trade_name.sql — Nom commercial (optionnel, affiché en priorité sur facture).

ALTER TABLE companies ADD COLUMN IF NOT EXISTS trade_name VARCHAR(255) NULL;
