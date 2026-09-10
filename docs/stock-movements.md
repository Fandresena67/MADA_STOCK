# MADA STOCK — Mouvements de stock (Étape 5)

## Principe

`products.quantity` = stock actuel (lecture rapide). **Toute variation passe par un
mouvement** : `PATCH /products` refuse `quantity` (400). Le mouvement est le journal
officiel, **immuable** (aucune route PUT/DELETE/PATCH sur l'historique).

## Types

- `initial` : stock initial à la création produit (même transaction ; si 0 → aucun mouvement).
- `in` : entrée (`before+q`). `out` : sortie (`before−q`, 409 si insuffisant).
- `adjustment` : `quantity` = stock **cible** ; `stored = |cible−avant|` ; no-op → 422.

## Transaction (1 connexion, FOR UPDATE, ROLLBACK/release)

`SELECT produit … FOR UPDATE` (tenant-scopé) → produit actif ? → calcul after ≥ 0 →
`UPDATE products` → `INSERT stock_movements` (before/after) → audit → COMMIT.
Produit inactif → 422. Hors tenant → 404.

## Idempotence (implémentée, pas reportée)

`idempotency_key` UUID optionnel, UNIQUE `(company_id, key)`. Rejeu → 200 + mouvement
existant (`deduplicated:true`), stock intact (contrainte PG = garde-fou concurrence).
Le frontend génère une clé par soumission (anti double-clic).

## Endpoints (`/api/v1/stock`)

- `POST /entries` (`stock.in`), `POST /exits` (`stock.out`), `POST /adjustments` (`stock.adjust`)
- `GET /movements` (`stock.view` : pagination, `product_id`, `movement_type`, `user_id`,
  `date_from/to`, `search` produit/motif/référence, tri) ; `GET /movements/:id` (tenant).
- Réponse : mouvement + `product_name/sku` + `author_name/email`, jamais de secret.

## Transferts — REPORTÉS (décision)

Aucun modèle `warehouse/location` : pas de faux `transfer_in/out`. La permission
`stock.transfer` existe mais **n'est utilisée par aucune route**. Vrai transfert =
étape dédiée (locations + balances + transaction source→destination).

## RLS

Inchangé (Étape 3) : préparé, non activé (rôle propriétaire contournerait RLS).
`SET LOCAL` utilisé dans les transactions de mouvements.
