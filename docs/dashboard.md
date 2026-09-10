# MADA STOCK — Dashboard, rapports, alertes (Étape 7)

## Décisions

- `sale_items.unit_cost` (015) : snapshot du `purchase_price` à la confirmation.
  Bénéfice historique = Σ(qty × (unit_price − unit_cost)) — jamais estimé sur prix actuel.
- Seule permission ajoutée (016) : `dashboard.view`. `reports.view` / `alerts.view`
  existaient déjà et sont réutilisés.
- Montants BIGINT en **strings** côté API (précision exacte, convention Étape 4) ;
  le frontend convertit pour Recharts (`toNum`, réaliste < 9e15 Ar).
- Recharts + React Query ajoutés (Recharts autorisé par le périmètre ; RQ pour
  cache 60 s + invalidation après confirmations/mouvements). Pas de sidebar
  (nav haute existante conservée + liens Dashboard/Rapports/Alertes), pas de toasts
  (notices inline existantes).

## Endpoints (`reports.view` / `alerts.view` / `dashboard.view`, tenant + SQL paramétré)

- `/dashboard/summary?from&to` : 8 KPI (valeurs stock, CA, bénéfice+coût, achats,
  produits, faible, ruptures). Période défaut 30 j, max 400 j.
- `/dashboard/{sales,purchases,revenue,profit}-trend` : séries complètes
  (generate_series, jour ≤ 62 j sinon mois).
- `/dashboard/stock-distribution`, `/top-products?limit` (défaut 5, max 20),
  `/recent-activity` (défaut 10, max 15), `/dashboard/alerts`, `/alerts`.
- `/reports/{stock,stockouts,sales,purchases,profit,movements}` (+ synthèses) ;
  `?format=csv` (mêmes filtres/tenant, 5000 lignes max, BOM Excel).
- Index : existants suffisants (company_id, dates, statuts) — aucune migration
  d'index nécessaire.
