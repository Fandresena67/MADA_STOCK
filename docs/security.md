# MADA STOCK — Sécurité (Étape 3, implémentée et testée)

## 1. Multi-tenant

- **Discriminant `company_id`** sur toutes les tables métier (`users.company_id`, futurs produits/ventes…).
- Le `companyId` vient **uniquement du JWT** (`authenticateJWT`), re-vérifié en base à chaque
  requête sensible (`attachFreshUser` : `JWT.companyId === DB.company_id`, sinon 401).
- **Aucun `req.body.companyId` / query param** n'est utilisé comme source d'autorisation.
- Toutes les requêtes ressources sont tenant-scopées : `WHERE id = $1 AND company_id = $2`.
- **Anti-IDOR** : ressource d'un autre tenant → **404** (pas 403, pas de leak d'existence).
- Chaîne middleware : `authenticateJWT → attachFreshUser → requireTenant → requireRole/requirePermission → validate → controller → service`.

## 2. Rôles & permissions

- Rôles : `super_admin` (global, routes `/superadmin/*` uniquement), `company_admin`
  (toutes les 39 permissions tenant, **implicites**), `employee` (permissions **explicites**
  de `user_permissions` uniquement, défaut = aucune).
- Le rôle JWT n'autorise rien seul : `requireRole` / `requirePermission` lisent `req.authUser`
  **rechargé depuis PostgreSQL à chaque requête**.
- Administration utilisateurs réservée aux rôles privilégiés (`company_admin` : employés de
  SON entreprise ; changement de rôle → `super_admin` ; jamais de `super_admin` via API).
- Référence : `backend/src/rbac/permissions.js` (miroir du seed `002_rbac.sql`, 39 codes).

## 3. Refresh tokens

- JWT `type=refresh` + `jti` aléatoire, transport prioritaire **cookie HttpOnly**
  (`madastock_refresh`, `SameSite=Lax`, `Secure` en prod, `Path=/api/v1/auth`) ; body accepté en compat.
- **Seul le hash SHA-256** est stocké (`refresh_tokens.token_hash`) — jamais le token brut, jamais loggé.
- **Rotation systématique** : chaque `/auth/refresh` révoque l'ancien (`revoked_at` + lien
  `replaced_by_token_id`) et émet un nouveau couple. Un ancien token → 401.
- **Reuse detection** : présentation d'un token révoqué → révocation de **toute la famille**
  (`revokeAllSessions`) + audit `AUTH_REFRESH_REUSE_DETECTED` + 401 générique.
- `POST /auth/logout` (révoque la session, efface le cookie), `POST /auth/logout-all`
  (soi-même, ou employés du tenant pour `company_admin`, ou global pour `super_admin`).
- Désactivation (`is_active=false`) ou suppression d'un utilisateur → sessions révoquées.

## 4. Audit

- Table `activity_logs` (`company_id`/`user_id` NULLables pour global/échec login).
- Service centralisé `audit.service.log()` : **transactionnel** quand un `client` est passé
  (échec d'audit → ROLLBACK, pas de perte silencieuse), best-effort sinon.
- Événements : `AUTH_REGISTER`, `AUTH_LOGIN_SUCCESS/FAILED`, `AUTH_REFRESH`,
  `AUTH_REFRESH_REUSE_DETECTED`, `AUTH_LOGOUT/ALL`, `USER_CREATED/UPDATED/DELETED/`
  `ACTIVATED/DEACTIVATED`, `PERMISSION_GRANTED/REVOKED`, `ROLE_CHANGED`,
  `COMPANY_ACTIVATED/DEACTIVATED`.
- **Aucun secret** : `scrubMetadata()` remplace `[REDACTED]` (mots de passe, tokens, secrets, cookies).
  Vérifié par test (aucune occurrence dans `activity_logs`).

## 5. RLS — état honnête : PRÉPARÉ, NON ACTIVÉ

- `005_rls_preparation.sql` : fonction `app_current_company_id()` + `db.setTenantContext()`
  (`SET LOCAL` **dans transaction explicite uniquement**, nettoyé auto → pas de fuite inter-requêtes,
  testé). Utilisé dans les transactions sensibles (register, login, rotation, admin users).
- **Non activé** car : (1) les tables appartiennent au rôle applicatif `madastock`, et le
  propriétaire contourne RLS → activation actuelle = **fausse sécurité** ; (2) une vraie RLS
  exige rôle propriétaire dédié + transfert de propriété + politiques (opération sensible).
- Planifié pour une étape dédiée. L'application reste la source de vérité du contrôle d'accès.

## 6. Endpoints auth

| Méthode | Route | Auth |
|---|---|---|
| POST | `/api/v1/auth/register` | public (rate-limit strict) |
| POST | `/api/v1/auth/login` | public (rate-limit strict) |
| POST | `/api/v1/auth/refresh` | cookie/body refresh |
| POST | `/api/v1/auth/logout` | JWT |
| POST | `/api/v1/auth/logout-all` | JWT (+ règles §3) |
| GET | `/api/v1/auth/me` | JWT → user + company + **permissions** (jamais de secret) |

## 7. Durcissement HTTP

Helmet, CORS whitelist (jamais `*`), rate-limit (global 300/15min, login/refresh/logout strict,
register 10/h), JSON `100kb`, erreurs génériques côté client, détails serveur uniquement,
`.env` ignorés, SQL 100 % paramétré, bcrypt cost 12.
