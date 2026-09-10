-- 014_confirm_permissions.sql — Seules permissions AJOUTÉES par l'Étape 6.
-- suppliers/customers : .view/.manage existants réutilisés (pas de doublons).
-- purchases/sales : .view/.create/.update/.cancel existants réutilisés.
-- invoices : .view/.create/.update existants réutilisés.
-- Ajout justifié : la confirmation impacte le stock → permission dédiée.

INSERT INTO permissions (code, name, description) VALUES
  ('purchases.confirm', 'Confirmer des achats', 'Confirmer un achat brouillon (génère les entrées de stock)'),
  ('sales.confirm', 'Confirmer des ventes', 'Confirmer une vente brouillon (génère les sorties de stock)')
ON CONFLICT (code) DO NOTHING;
