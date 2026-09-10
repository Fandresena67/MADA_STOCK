-- 016_dashboard_permission.sql — Seule permission ajoutée par l'Étape 7.
-- reports.view et alerts.view existent déjà (002) et sont réutilisés.

INSERT INTO permissions (code, name, description) VALUES
  ('dashboard.view', 'Voir le tableau de bord', 'Consulter KPI, tendances, top produits et activité de son entreprise')
ON CONFLICT (code) DO NOTHING;
