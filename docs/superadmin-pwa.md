# MADA STOCK — Super Admin, paramètres, PWA, hardening (Étape 8)

## Super Admin (global, jamais tenant)

- Routes `/api/v1/superadmin/*` : `requireRole('super_admin')` sur utilisateur **rechargé
  en base** (pas de permission `superadmin.*` dupliquée : le rôle frais fait autorité).
  Pas de `requireTenant` ici — par conception.
- `GET /dashboard` : entreprises (total/actives/désactivées), utilisateurs
  (total/actifs/super_admins), produits, ventes confirmées, CA global.
- `GET /companies?search` (+ produits/utilisateurs comptés), `GET /:id`,
  `PATCH /:id {is_active}` : désactivation → **révocation immédiate de toutes les
  sessions** de l'entreprise + blocage login/refresh/routes (vérifié 401).
  Jamais de suppression destructive.
- `GET /users?search&company_id&role&is_active`, `GET /:id`,
  `PATCH /:id` (rôle employee/company_admin, activation ; **jamais `super_admin`
  via API** — Zod 400 + service 403 ; auto-désactivation 403).
- `GET /audit?action&company_id&user_id&dates` (metadata scrubbées, aucun secret).
- Création de super_admin : **aucune route** — SQL contrôlé uniquement.
- Pages `/superadmin/*` + gate rôle `/me` (le backend reste l'autorité).

## Entreprise désactivée — enforcement (faille E7 corrigée)

`login`, `refresh` (session révoquée + check), `attachFreshUser` (toutes routes RBAC),
`/me` rejettent (401 générique). Réactivation → fonctionnement normal.

## Paramètres (`/settings`, migration 017)

`GET` (`settings.view`), `PATCH` (`company_admin` + `settings.update`) :
nom/email/téléphone/adresse/ville/pays. **Devise verrouillée MGA**, `currency`
rejeté par Zod (strip). Audit `COMPANY_UPDATED`.

## PWA

- `vite-plugin-pwa` (unique plugin), manifest statique FR standalone, icônes PNG
  locales générées (192/512/maskable/apple-touch, monogramme MS).
- Workbox : precache assets build uniquement ; navigations → `/index.html`
  (denylist `/api/`) ; runtime CacheFirst **images/fonts same-origin uniquement**.
  **Aucune donnée API/JWT mise en cache** (vérifié dans `dist/sw.js`).
- `OnlineStatus` (bandeau « connexion requise », aucune écriture offline),
  `UpdateBanner` (prompt, jamais forcé), SW actif en production uniquement.
- Déploiement futur (non effectué) : fallback SPA requis —
  Vercel `{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}`,
  nginx `try_files $uri /index.html`.

## Hardening vérifié

Helmet (CSP, nosniff, SAMEORIGIN), CORS whitelist 403, rate-limit, JSON 100kb,
cookies HttpOnly+SameSite=Lax+Path, JWT minimal sans secret, SQL paramétré,
Zod partout, erreurs génériques, `.env` ignorés, aucun secret versionné.

## Code-splitting

`React.lazy` par page + `manualChunks: {recharts}` : warning chunk E7 résorbé,
toutes routes re-testées au build.
