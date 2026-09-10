# database/ — MADA STOCK

PostgreSQL 16 est géré par Docker (`docker-compose.yml`, service `db`, port hôte **5435**).

- Volume persistant : `madastock_postgres_data` (survit à `docker compose down`).
- Ne jamais utiliser `docker compose down -v` sans demande explicite.
- Les migrations versionnées vivent dans `backend/migrations/` et s'appliquent via `npm run migrate`.
- Aucun dump avec données réelles ne doit être committé ici.
- Clusters hôtes Ubuntu (PG 14/5432, PG 16/5434) : ne pas toucher.
