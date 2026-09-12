-- 018_users_avatar.sql — Photo de profil utilisateur (référence fichier local, NULL = initiales)
-- Rétrocompatible : colonne NULLABLE, les utilisateurs existants gardent avatar_url = NULL.

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT NULL;
