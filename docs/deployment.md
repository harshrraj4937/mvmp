# Deployment

Status: Phase 1 — verified 2026-10-27 by a Compose smoke test (see
`diagrams/implementation-progress.md`, Phase 1 report).

## Services

| Service | Container | Image | Published port | Purpose |
|---|---|---|---|---|
| postgres | gillu-postgres | postgres:16-alpine | none | Database, named volume `postgres_data` |
| redis | gillu-redis | redis:7-alpine | none | BullMQ backend (used from Phase 5), AOF on, volume `redis_data` |
| migrate | gillu-migrate | app image, `tooling` stage | none | One-shot `drizzle-kit migrate`; exits 0 |
| web | gillu-web | app image, `runner` stage | none (`expose: 3000`) | Next.js standalone server, non-root `node` user, healthcheck `/api/health` |
| nginx | gillu-nginx | nginx:1.27-alpine | `${HTTP_BIND:-127.0.0.1}:${HTTP_PORT:-8080}` → 80 | Reverse proxy, JSON access logs, request ids |

Start order: postgres healthy → migrate completes → (redis healthy) → web
healthy → nginx. Later phases add `outbox-dispatcher` (5), `payment-worker`
(6) and `shipping-worker` (7), reusing the app image with another command.

## Environment variables

Read by the app through `src/platform/env.ts` (validated with Zod at startup;
errors name the variable, never its value).

| Variable | Required | Notes |
|---|---|---|
| `POSTGRES_PASSWORD` | yes (Compose) | Hex string; Compose builds `DATABASE_URL` from it |
| `DATABASE_URL` | yes (outside Compose) | `postgres://` or `postgresql://` URL |
| `AUTH_SECRET` | yes | ≥ 32 characters (`openssl rand -hex 32`) |
| `NEXT_PUBLIC_APP_URL` | yes | Public URL; **embedded at build time** — rebuild when it changes |
| `NEXT_SERVER_APP_URL` | yes | Same public URL, used by better-auth |
| `HTTP_BIND`, `HTTP_PORT` | no | nginx bind address/port (default `127.0.0.1:8080`) |
| `LOG_LEVEL` | no | `fatal`…`trace`, default `info` |
| `REDIS_URL` | no | Set by Compose to `redis://redis:6379` |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | no | Google sign-in appears only when both are set |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | no | GitHub sign-in |
| `UPLOADTHING_TOKEN`, `UPLOADTHING_SECRET_KEY` | no | Image uploads |
| `GILLU_ENV_FILE` | no | Path of the env file Compose loads (default `.env`) |

## Local development (no Docker for the app)

```bash
bun install
cp .env.example .env        # fill DATABASE_URL (any Postgres you own), AUTH_SECRET, URLs
bun run db:migrate          # apply committed migrations
bun dev
```

Schema changes: edit `src/db/schema/**`, then `bun run db:generate`, review the
SQL in `drizzle/`, commit it, and `bun run db:migrate`. Auth tables come from
`bun run db:auth` (better-auth CLI) followed by `db:generate`.
`bun run db:push` remains only for throwaway local databases.

## Local full stack (Docker Compose)

```bash
cp .env.docker.example .env   # set POSTGRES_PASSWORD and AUTH_SECRET
docker compose up --build -d --wait
curl http://localhost:8080/api/health   # {"checks":{"database":"ok"},"status":"ok"}
```

## Production

1. Provision a host with Docker Engine + Compose v2.
2. Create `.env` from `.env.docker.example` with strong secrets; set both app
   URLs to the public **HTTPS** URL.
3. Terminate TLS in front of nginx (load balancer or a TLS-enabled nginx
   server block) and set `HTTP_BIND`/`HTTP_PORT` so only that TLS layer can
   reach port 80 of `gillu-nginx`.
4. `docker compose up --build -d --wait`. Every deploy re-runs `migrate`;
   already-applied migrations are skipped.
5. Bootstrap the first admin after that person has signed up:
   `docker compose run --rm migrate bun run admin:grant <email>`.

Security notes:
- Postgres and Redis publish no host ports; reach them with
  `docker compose exec`.
- nginx **overwrites** `X-Forwarded-For` with the connecting address.
  better-auth rate-limits sign-in/sign-up per client IP (3 per 10 s in
  production); appending instead would let clients spoof the header and
  bypass the limit. If another proxy sits in front of nginx, use nginx's
  `real_ip` module with that proxy's address as the trusted source.
- `.env` files are excluded from the image (`.dockerignore`).

## Data safety

- `docker compose down` keeps data; `docker compose down -v` deletes the
  Postgres and Redis volumes.
- The Compose project is named `gillu`, so its volumes are
  `gillu_postgres_data` and `gillu_redis_data`. A volume from the earlier
  unnamed setup (`relivator_postgres_data`) is **not** reused or modified;
  migrate any data from it manually if needed.
- Changing `POSTGRES_PASSWORD` after the volume exists does not change the
  password stored in the database.

## Known limitations

- `next start` warns under `output: "standalone"`; it is used only by the
  E2E runner. Containers run `node server.js` from the standalone output.
- No TLS configuration ships in `deploy/nginx/default.conf`.
- Redis has no password; it is reachable only on the internal network.
