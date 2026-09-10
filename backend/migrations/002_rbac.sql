-- 002_rbac.sql — Permissions granulaires + user_permissions (+ seed système)
-- Idempotent : IF NOT EXISTS / ON CONFLICT DO NOTHING. Aucune donnée métier.

CREATE TABLE IF NOT EXISTS permissions (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(64) NOT NULL UNIQUE,
  name        VARCHAR(128) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_permissions (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, permission_id)
);

CREATE INDEX IF NOT EXISTS user_permissions_user_idx ON user_permissions (user_id);
CREATE INDEX IF NOT EXISTS user_permissions_perm_idx ON user_permissions (permission_id);

-- Seed des permissions système (référence : backend/src/rbac/permissions.js)
INSERT INTO permissions (code, name, description) VALUES
  ('users.view', 'Voir les utilisateurs', 'Lister et voir les utilisateurs de son entreprise'),
  ('users.create', 'Créer des utilisateurs', 'Créer des employés dans son entreprise'),
  ('users.update', 'Modifier des utilisateurs', 'Modifier / activer / désactiver des employés de son entreprise'),
  ('users.delete', 'Supprimer des utilisateurs', 'Supprimer des employés de son entreprise'),
  ('roles.view', 'Voir les rôles', 'Voir les rôles et permissions de son entreprise'),
  ('roles.manage', 'Gérer les permissions', 'Accorder / révoquer des permissions aux employés'),
  ('products.view', 'Voir les produits', 'Consulter le catalogue de son entreprise'),
  ('products.create', 'Créer des produits', 'Créer des produits'),
  ('products.update', 'Modifier des produits', 'Modifier des produits'),
  ('products.delete', 'Supprimer des produits', 'Supprimer des produits'),
  ('categories.view', 'Voir les catégories', 'Consulter les catégories'),
  ('categories.create', 'Créer des catégories', 'Créer des catégories'),
  ('categories.update', 'Modifier des catégories', 'Modifier des catégories'),
  ('categories.delete', 'Supprimer des catégories', 'Supprimer des catégories'),
  ('stock.view', 'Voir le stock', 'Consulter les niveaux de stock'),
  ('stock.in', 'Entrées de stock', 'Enregistrer des entrées de stock'),
  ('stock.out', 'Sorties de stock', 'Enregistrer des sorties de stock'),
  ('stock.adjust', 'Ajustements de stock', 'Ajuster le stock (inventaire)'),
  ('stock.transfer', 'Transferts de stock', 'Transférer du stock'),
  ('suppliers.view', 'Voir les fournisseurs', 'Consulter les fournisseurs'),
  ('suppliers.manage', 'Gérer les fournisseurs', 'Créer / modifier / supprimer des fournisseurs'),
  ('customers.view', 'Voir les clients', 'Consulter les clients'),
  ('customers.manage', 'Gérer les clients', 'Créer / modifier / supprimer des clients'),
  ('sales.view', 'Voir les ventes', 'Consulter les ventes'),
  ('sales.create', 'Créer des ventes', 'Enregistrer des ventes'),
  ('sales.update', 'Modifier des ventes', 'Modifier des ventes'),
  ('sales.cancel', 'Annuler des ventes', 'Annuler / rembourser des ventes'),
  ('purchases.view', 'Voir les achats', 'Consulter les achats'),
  ('purchases.create', 'Créer des achats', 'Enregistrer des achats'),
  ('purchases.update', 'Modifier des achats', 'Modifier des achats'),
  ('purchases.cancel', 'Annuler des achats', 'Annuler des achats'),
  ('invoices.view', 'Voir les factures', 'Consulter les factures'),
  ('invoices.create', 'Créer des factures', 'Émettre des factures'),
  ('invoices.update', 'Modifier des factures', 'Modifier des factures'),
  ('reports.view', 'Voir les rapports', 'Consulter rapports et statistiques'),
  ('alerts.view', 'Voir les alertes', 'Consulter les alertes de stock'),
  ('settings.view', 'Voir les paramètres', 'Voir les paramètres de l''entreprise'),
  ('settings.update', 'Modifier les paramètres', 'Modifier les paramètres de l''entreprise'),
  ('audit.view', 'Voir le journal', 'Consulter le journal d''activité de l''entreprise')
ON CONFLICT (code) DO NOTHING;
