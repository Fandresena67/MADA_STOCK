# MADA STOCK — Commerce : tiers, achats, ventes, factures (Étape 6)

## Tiers (suppliers/customers)

CRUD sans DELETE (désactivation `is_active`). Recherche nom/email/téléphone, pagination,
filtre actif. Permissions réutilisées : `suppliers.view/.manage`, `customers.view/.manage`
(`.manage` = créer/modifier/désactiver — pas de doublons `.create/.update`).

## Documents (purchases/sales, moteur partagé `doc.service.js`)

- `POST /` → brouillon (lignes validées, produits/tiers tenant+actifs, **totaux recalculés
  serveur**, formule `ligne = max(0,q×pu−remise)+taxe`, `total = max(0,sub−remises)+taxes`).
- `PATCH /:id` → brouillon uniquement (lignes remplacées + recalcul) ; `{status:cancelled}`
  = annulation brouillon (aucun stock). Confirmé → 409 immuable.
- `POST /:id/confirm` → transaction : verrou doc FOR UPDATE → statut draft ? (sinon 409,
  confirmé → état actuel `alreadyConfirmed`, **zéro nouveau mouvement**) → tiers/produits
  re-vérifiés → `applyMovement` par ligne (réf `ACH-/VTE-…`) → confirmed + audit → COMMIT.
  Stock insuffisant (ventes) → 409 + ROLLBACK total.
- Références `ACH/VTE-AAAA-NNNNNN` via séquences (jamais COUNT+1).
- Permissions réutilisées + **`purchases.confirm` / `sales.confirm` ajoutées** (seules neuves :
  impact stock = autorisation distincte).

## Factures

- `POST /invoices` : depuis vente **confirmée** (snapshot lignes + recalcul, UNIQUE 1:1)
  ou autonome (`customer_id` + lignes, `product_name` snapshoté).
- `PATCH /:id/status` : draft→issued→paid, draft/issued→cancelled, paid final (409 sinon).
- Numéros `FAC-AAAA-NNNNNN` (séquence). Vue imprimable CSS (`window.print`, pas de PDF).

## Annulation post-confirmation — REPORTÉE

Exige mouvements de compensation + gestion factures liées : à concevoir en étape dédiée.
État actuel : confirmés immuables (garantie d'audit), brouillons annulables.

## Intégrité

FK RESTRICT (produits/tiers/sales mouvementés ou documentés) : une suppression d'entreprise
avec historique est refusée par PostgreSQL (nettoyage tests en ordre inverse). History
préservée (user SET NULL → « Compte supprimé »).
