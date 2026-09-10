# MADA STOCK

## Présentation

Application SaaS de gestion de stock multi-tenant : chaque entreprise dispose d'un
espace isolé (produits, stock, achats, ventes, factures, rapports). Monnaie : Ariary (MGA).

## Fonctionnalités

- Authentification JWT + refresh rotation (cookies HttpOnly), logout / logout-all
- Multi-tenant strict (isolation `company_id`, anti-IDOR 404)
- RBAC : `super_admin` / `company_admin` / `employee` + 42 permissions
- Inventaire : catégories, produits (SKU, seuils, statuts RUPTURE/FAIBLE/NORMAL)
- Mouvements : entrées, sorties, ajustements, historique immuable, idempotence
- Fournisseurs, clients (sans suppression destructive)
- Achats, ventes (brouillon → confirmation atomique + mouvements, confirmé immuable)
- Factures (liée 1:1 à une vente confirmée ou autonome, vue imprimable)
- Dashboard (8 KPI, tendances, top produits, activité, alertes), rapports + export CSV
- Audit complet (`activity_logs`, aucun secret)
- Super Admin global (dashboard, entreprises, utilisateurs, audit)
- Paramètres entreprise (devise MGA verrouillée)
- PWA installable (manifest + service worker, aucune donnée API mise en cache)

## Architecture

```text
React (Vite) → API REST Express → PostgreSQL
```

## Technologies

Frontend : React 18, Vite 5, JavaScript, Tailwind CSS 3, React Router 6,
TanStack React Query 5, Recharts 2, Axios, vite-plugin-pwa.
Backend : Node.js 20+, Express 4, `pg`, JWT, bcryptjs, Zod, Helmet, CORS,
express-rate-limit, cookie-parser.
Base : PostgreSQL 16 (Docker, port **5435**).

## Installation

```bash
git clone <url> && cd Stock_Mada

# 1. PostgreSQL Docker (port 5435 — ne pas toucher 5432/5434)
docker compose up -d && docker compose ps

# 2. Backend (http://localhost:5000)
cd backend
cp .env.example .env   # renseigner DB_PASSWORD + JWT_SECRET forts
npm install
npm run migrate        # 001 → 017
npm run dev            # GET /api/v1/health

# 3. Frontend (http://localhost:5174)
cd ../frontend
cp .env.example .env   # VITE_API_URL=http://localhost:5000/api/v1
npm install
npm run dev
```

Premier super_admin : création SQL contrôlée uniquement (aucune route API) :
`INSERT INTO users (company_id, name, email, password_hash, role) VALUES (NULL, ...)`
avec hash bcrypt. Voir `docs/DEPLOYMENT.md`.

## Développement

| Service  | Port | URL                           |
|----------|------|-------------------------------|
| API      | 5000 | http://localhost:5000/api/v1  |
| Frontend | 5174 | http://localhost:5174         |
| Postgres | 5435 | `madastock` / user `madastock` |

## Base de données

PostgreSQL 16 Docker (`madastock-db`, volume persistant `madastock_postgres_data`).
Migrations versionnées : `backend/migrations/001 → 017` (`npm run migrate`).
Ne jamais utiliser `docker compose down -v`. Clusters hôtes 5432/5434 : ne pas toucher.

## Sécurité

- JWT access court + refresh rotatifs (hash SHA-256 en base, reuse detection)
- Cookies `HttpOnly`, `SameSite=Lax`, `Secure` en production, `Path=/api/v1/auth`
- RBAC rechargé en base à chaque requête ; rôle JWT jamais suffisant seul
- Tenant : `company_id` du token re-vérifié, 404 inter-tenant
- Zod partout, SQL 100 % paramétré, Helmet, CORS whitelist, rate limiting
- Entreprise désactivée : login/refresh/API bloqués + sessions révoquées
- Aucun secret commité (`.env` ignorés, seuls `.env.example` versionnés)

## PWA

Installable (manifest FR, icônes locales, `display: standalone`). Service worker :
assets statiques uniquement, **aucune réponse `/api` mise en cache**. Bandeau hors-ligne
honnête (aucune écriture offline), prompt de mise à jour non agressif.

## Déploiement

Préparation uniquement — **application non déployée**. Voir `docs/DEPLOYMENT.md`
(variables, CORS, cookies, migrations, backup, monitoring, fallback SPA).
