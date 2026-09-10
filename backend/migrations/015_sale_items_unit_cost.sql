-- 015_sale_items_unit_cost.sql — Snapshot du coût d'achat au moment de la confirmation.
-- Le bénéfice historique = Σ(qty × (unit_price − unit_cost)), jamais estimé sur prix actuel.
-- Backfill : lignes existantes (tests) ← purchase_price courant du produit.

ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS unit_cost BIGINT NOT NULL DEFAULT 0 CHECK (unit_cost >= 0);

UPDATE sale_items si
SET unit_cost = p.purchase_price
FROM products p
WHERE si.product_id = p.id AND si.unit_cost = 0;
