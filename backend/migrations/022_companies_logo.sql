-- 022_companies_logo.sql — Logo entreprise (référence fichier local, NULL = sans logo)
-- Rétrocompatible : colonne NULLABLE. Dossier séparé : backend/uploads/logos/.

ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT NULL;
