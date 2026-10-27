# Testing

Status: Phase 1 — layers below are implemented and green as of 2026-10-27.
Governed by: [design](superpowers/specs/2026-10-27-gillu-marketplace-design.md) §8, requirements §25.

## Prerequisites

- bun (package manager), Node ≥ 20.9
- Docker (integration tests start Postgres with Testcontainers; E2E starts
  `docker-compose.test.yml`)
- Chromium for Playwright: `bunx playwright install chromium`

## Layers

| Layer | Command | Location | What it uses |
|---|---|---|---|
| Unit | `bun run test:unit` | `tests/unit/**` | Pure functions, no IO |
| Integration | `bun run test:integration` | `tests/integration/**` | One Testcontainers `postgres:16-alpine` per run, real migrations applied in `tests/integration/global-setup.ts`; tests read the URL with `inject("databaseUrl")` and connect via `tests/integration/support/db.ts` |
| Unit + integration | `bun run test` | | |
| E2E | `bun run test:e2e` | `tests/e2e/**` | `scripts/e2e.ts`: throwaway Postgres (tmpfs, `127.0.0.1:54329`) → `db:migrate` → `next build` → Playwright against `next start` on `:3100` → tear down |
| Static | `bun run typecheck`, `bun run lint`, `bun run knip` | | tsc, ESLint + Biome, knip |

E2E never touches a dev or production database; `AUTH_SECRET` is random per run.

## E2E conventions

- Import `test`/`expect` from `tests/e2e/helpers.ts`, not from
  `@playwright/test`: the extended `test` gives every test its own
  `x-forwarded-for` client IP, because better-auth limits sign-in/sign-up to
  3 requests per 10 s per IP in production.
- Form helpers (`signUp`, `signIn`, `signOut`) wait until React has hydrated
  the inputs before filling; filling earlier gets reset by hydration.
- `grantAdminRole(email)` grants admin through the real `admin:grant` CLI.

## Current coverage (Phase 1)

| Suite | Tests |
|---|---|
| `tests/unit/platform/env.test.ts` | valid env + LOG_LEVEL default; empty optional = absent; missing/non-postgres `DATABASE_URL`; short `AUTH_SECRET` named without echoing it |
| `tests/unit/platform/request-id.test.ts` | keeps safe ids; replaces null, empty, short, spaced, newline-injected, oversize ids |
| `tests/unit/platform/logger.test.ts` | secret keys redacted at top level and one level down |
| `tests/unit/db/auth-db-transform.test.ts` | generated relations stripped without losing tables; unknown CLI output refused |
| `tests/unit/identity/roles.test.ts` | `isAdmin` for admin, multi-role, user, null, missing, look-alike role |
| `tests/integration/db/migrations.test.ts` | baseline tables exist, no Polar tables; re-running migrations is a no-op |
| `tests/integration/identity/grant-admin.test.ts` | grants (keeps existing roles / no role); idempotent; unknown email rejected |
| `tests/integration/platform/health.test.ts` | ok for live DB; unreachable for dead DB within the timeout |
| `tests/e2e/auth.spec.ts` | sign up → sign out → sign in; wrong password shows error, no session; duplicate sign-up shows error |
| `tests/e2e/admin-guard.spec.ts` | signed-out → sign-in; non-admin → 404; admin via CLI → 200; non-admin never receives another user's email (404 HTML and forged RSC request claiming the `/admin` layout is loaded) |
| `tests/e2e/health.spec.ts` | `/api/health` ok + request id echo + no-store; pages get a generated request id |

Deployment smoke (manual, Phase 1): `docker compose up --build -d --wait`, then
`curl -H 'x-request-id: compose-smoke-0001' http://127.0.0.1:8080/api/health`.

## Not yet covered

Provider contract/sandbox suites (Phases 6–7) and Scenarios A–J (from the
phase that makes each possible). Google OAuth is not automatable; it will be
verified manually once credentials exist.
