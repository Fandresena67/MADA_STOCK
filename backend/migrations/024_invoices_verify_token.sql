-- 024_invoices_verify_token.sql — Token public de vérification par facture.
-- 64 hex aléatoires (128 bits), non prédictible, UNIQUE. Backfill des existantes.

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS verify_token CHAR(64) NULL;

UPDATE invoices
SET verify_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
WHERE verify_token IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_verify_token_unique') THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_verify_token_unique UNIQUE (verify_token);
  END IF;
END $$;
