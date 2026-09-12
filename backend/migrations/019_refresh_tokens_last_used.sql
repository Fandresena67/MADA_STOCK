-- 019_refresh_tokens_last_used.sql — Dernière activité par session (affichage "Sessions et appareils").
-- Rétrocompatible : colonne NULLABLE, les lignes existantes gardent last_used_at = NULL
-- (le frontend affiche alors created_at en repli).

ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ NULL;
