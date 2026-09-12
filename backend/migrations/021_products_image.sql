-- 021_products_image.sql — Photo produit (référence fichier local, NULL = sans photo)
-- Rétrocompatible : colonne NULLABLE, les produits existants gardent image_url = NULL.
-- Le binaire n'est jamais stocké en base (filesystem backend/uploads/products/).

ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT NULL;
