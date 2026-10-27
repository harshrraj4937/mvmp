# Testing

Status: Phase 2 — layers below are implemented and green as of 2026-10-27 (branch `gillu/phase-2`).
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
- `signUpFresh(page, prefix)` signs up a new user and waits for the redirect;
  `onboardMerchant(page, overrides)` creates a shop through the API;
  `apiJson(response)` returns `{ status, body }`.
- A second actor (admin, other merchant) uses `newClientContext(browser)`,
  which gets its own `x-forwarded-for` so rate limits do not collide.
- `forgedAdminRscHeaders()` builds an RSC request claiming the `/admin`
  layout is already rendered, with a router-state tree Next 16 accepts. Tests
  that use it also assert the response is `text/x-component`; a tree Next
  rejects would otherwise pass without testing anything.
- Locators that could also match the header or footer (e.g. "Sign up",
  "GitHub") are scoped to `main` or the form.

Shared merchant fixtures: `tests/support/merchant-fixtures.ts`
(`validOnboarding()` with messy Indian input: `"560 001"`,
`"+91 98765 43210"`), `tests/integration/support/merchants.ts` (`seedUser`,
`seedMerchant`, parsed `onboarding()`).

## Current coverage (Phases 1–2)

| Suite | Tests |
|---|---|
| `tests/unit/platform/env.test.ts` | valid env + LOG_LEVEL default; empty optional = absent; missing/non-postgres `DATABASE_URL`; short `AUTH_SECRET` named without echoing it |
| `tests/unit/platform/request-id.test.ts` | keeps safe ids; replaces null, empty, short, spaced, newline-injected, oversize ids |
| `tests/unit/platform/logger.test.ts` | secret keys redacted at top level and one level down |
| `tests/unit/db/auth-db-transform.test.ts` | generated relations stripped without losing tables; unknown CLI output refused |
| `tests/unit/identity/roles.test.ts` | `isAdmin` for admin, multi-role, user, null, missing, look-alike role |
| `tests/unit/identity/safe-next-path.test.ts` | `?next=` accepts same-site paths; rejects absolute/protocol-relative URLs, backslashes, encoded slashes, whitespace, control characters (tab/CR/LF, raw or `%09`), undecodable input |
| `tests/unit/identity/auth-social.test.ts` | Google/GitHub configured only with id and secret; profile → first/last name |
| `tests/unit/platform/http.test.ts` | error shape + request id; subclass status/codes; unknown error → generic 500 (no message leak); non-JSON body; field errors; `ok()` + `no-store` |
| `tests/unit/merchants/status.test.ts` | every allowed and refused transition; only APPROVED sells |
| `tests/unit/merchants/profile-rules.test.ts` | locked fields per status; only owners manage the profile |
| `tests/unit/merchants/schemas.test.ts` | phone/PIN normalisation, uppercase compliance ids, blank = absent, https logo, reserved/invalid slugs, patch and reject-reason rules |
| `tests/integration/db/migrations.test.ts` | baseline tables exist, no Polar tables; re-running migrations is a no-op |
| `tests/integration/identity/grant-admin.test.ts` | grants (keeps existing roles / no role); idempotent; unknown email rejected |
| `tests/integration/platform/health.test.ts` | ok for live DB; unreachable for dead DB within the timeout |
| `tests/integration/merchants/register.test.ts` | DRAFT shop + owner + primary pickup in one transaction; `slug_taken` leaves nothing; one owned shop; double-submitted onboarding creates exactly one; owner-first membership resolution |
| `tests/integration/merchants/profile.test.ts` | owner edits/clears fields; staff refused; approved slug locked with nothing written; under review refused; `slug_taken`; submit/resubmit clears rejection reason |
| `tests/integration/merchants/review.test.ts` | approve records reviewer; draft not approvable; reject/suspend/reinstate; unknown id 404; two concurrent admins → exactly one wins; queue filter + owner email; approve/reinstate only from their own state |
| `tests/integration/merchants/pickup.test.ts` | primary handling; another merchant's id → 404 and unchanged; only primary cannot be unset; DB rejects bad PIN |
| `tests/e2e/auth.spec.ts` | sign up → sign out → sign in; wrong password shows error, no session; duplicate sign-up shows error; social buttons hidden when unconfigured; safe `next` honoured, off-site `next` ignored, `next` hiding a tab/newline stays on site (server and client redirect) |
| `tests/e2e/merchant-api.spec.ts` | 401 with request id; 403 without shop; one shop per user (409); field errors; edit → submit → `under_review`; only admins review (403, queue, 409 on double approve, 400 bad status/reason); cross-merchant pickup id → 404 |
| `tests/e2e/merchant-onboarding.spec.ts` | signed-out → sign up → back to onboarding via `next`; UI onboarding → draft → submit → under review, dashboard refused; invalid phone shows field error, no shop; approved dashboard, locked fields, "Unverified", profile save, shipping page; suspension applies on the next request |
| `tests/e2e/admin-merchants.spec.ts` | Scenario A (submit → admin approves in UI → merchant dashboard); rejection reason shown to merchant; non-admin 404 on list and detail with no contact email in HTML or forged RSC, API 403 |
| `tests/e2e/admin-guard.spec.ts` | signed-out → sign-in; non-admin → 404; admin via CLI → 200; non-admin never receives another user's email (404 HTML and forged RSC request claiming the `/admin` layout is loaded) |
| `tests/e2e/health.spec.ts` | `/api/health` ok + request id echo + no-store; pages get a generated request id |

Deployment smoke (manual, Phases 1–2): `docker compose up --build -d --wait`, then
`curl -H 'x-request-id: compose-smoke-0001' http://127.0.0.1:8080/api/health`
and `curl http://127.0.0.1:8080/api/v1/merchant/profile` (401 JSON with
`requestId`).

## Not yet covered

Provider contract/sandbox suites (Phases 6–7) and Scenarios B–J (from the
phase that makes each possible; Scenario A is covered from Phase 2). Google
OAuth is not automatable; it will be verified manually once credentials
exist.
