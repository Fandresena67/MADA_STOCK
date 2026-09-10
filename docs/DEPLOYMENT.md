# MADA STOCK — Préparation au déploiement (non déployé)

## Architecture production

```text
Navigateur (PWA) → HTTPS → Frontend statique → HTTPS → API Express → PostgreSQL managé
```

## Frontend (variables publiques `VITE_*` uniquement)

```bash
VITE_API_URL=https://api.example.com/api/v1
npm run build   # → dist/ (PWA incluse)
```

Jamais dans le frontend : `DATABASE_URL`, `DB_PASSWORD`, `JWT_SECRET`, `SMTP_*`.
Fallback SPA obligatoire côté hébergeur (ex. Vercel) :

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

ou nginx : `try_files $uri /index.html;`

## Backend (variables privées, jamais commitées)

```bash
NODE_ENV=production
PORT=5000
DB_HOST=db.example.com
DB_PORT=5432
DB_NAME=madastock
DB_USER=madastock
DB_PASSWORD=<secret fort>
JWT_SECRET=<64+ caractères hex>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=https://app.example.com
```

`NODE_ENV=production` active : cookies `Secure`, erreurs génériques (jamais de
stack/SQL/secrets), logs adaptés.

## PostgreSQL

PostgreSQL managé recommandé (16+). Base privée (non exposée), utilisateur moindre
privilège, `statement_timeout` raisonnable.

## HTTPS

Obligatoire (cookies `Secure`, PWA et service worker exigent un contexte sécurisé).

## CORS

Whitelist stricte au domaine frontend (`FRONTEND_URL`, jamais `*` avec credentials).

## Cookies

`HttpOnly` + `Secure` + `SameSite=Lax` + `Path=/api/v1/auth` (déjà configurés).

## Migrations

```bash
npm run migrate   # 001 → 017, idempotentes, dans l'ordre
```

1. Provisionner PostgreSQL. 2. Configurer l'accès. 3. `npm run migrate`.
4. Créer le premier `super_admin` en SQL contrôlé (hash bcrypt, `company_id NULL`).
5. Démarrer le backend. 6. Configurer CORS + frontend. 7. Tester login,
   isolation tenant, Super Admin. Ne pas exécuter sur une base distante sans backup.

## Backup

- Backup automatique quotidien PostgreSQL, restauration testée, rétention 30 jours.
- Ne jamais versionner de dump contenant des données réelles.

## Monitoring

Disponibilité API (`GET /api/v1/health`), erreurs backend (sans secrets),
espace disque et connexions PostgreSQL, expiration certificats HTTPS.

## PWA

Service worker : assets statiques uniquement, jamais `/api`. Vérifier manifest,
icônes et installation après chaque déploiement frontend.

## Sécurité (rappels)

Secrets uniquement en variables d'environnement (rotation en cas de fuite),
base non exposée, CORS strict, HTTPS partout, principe du moindre privilège,
mises à jour de dépendances planifiées (jamais de `--force` aveugle).
