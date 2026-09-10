-- 005_rls_preparation.sql — RLS : PRÉPARATION UNIQUEMENT (pas de fausse sécurité)
--
-- Constat honnête (voir docs/security.md § RLS) :
--  1. Les tables appartiennent au rôle applicatif `madastock`, or le propriétaire
--     d'une table contourne RLS. Activer RLS aujourd'hui ne protégerait donc rien.
--  2. Une RLS réelle exige : rôle propriétaire dédié + rôle applicatif restreint +
--     transfert de propriété + politiques + contexte tenant par transaction.
--     C'est une opération sensible, planifiée pour une étape dédiée.
--
-- Cette migration ne fait donc QU'UNE CHOSE SÛRE : fournir la fonction de lecture
-- du contexte tenant, posée par l'application via `SET LOCAL app.company_id`
-- dans des transactions explicites (voir src/config/db.js : setTenantContext).
-- Aucun `ENABLE ROW LEVEL SECURITY`, aucune politique permissive factice.

CREATE OR REPLACE FUNCTION app_current_company_id() RETURNS INTEGER AS $$
  SELECT NULLIF(current_setting('app.company_id', TRUE), '')::INTEGER;
$$ LANGUAGE SQL STABLE;
