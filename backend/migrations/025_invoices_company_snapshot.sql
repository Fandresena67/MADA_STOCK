-- 025_invoices_company_snapshot.sql — Photo d'identité entreprise au moment de la création.
-- JSONB NULLABLE : les factures antérieures (NULL) affichent les données live (repli sans casse).

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS company_snapshot JSONB NULL;
