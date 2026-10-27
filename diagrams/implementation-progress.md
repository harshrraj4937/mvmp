# Gillu Implementation Progress

Canonical tracker. `docs/implementation-progress.md` points here.
Rule: a phase is COMPLETED only after its verification commands were run in a
session and passed (requirements §29). Status values: NOT_STARTED,
IN_PROGRESS, COMPLETED, BLOCKED, NEEDS_INPUT.

## Current Phase
Phase 2 — Merchant Authentication (not started)

## Audit Notes

2026-10-27: the previous version of this file claimed Phase 0 and Phase 1
were COMPLETED, Google OAuth and the merchant schema were done, and
TypeScript/unit tests were passing. Verified against the code on branch
`main` at `a1871b0`, those claims were false: Polar was still wired into
better-auth, API routes and schema; no merchant tables existed; there was no
`docs/` directory, no installed dependencies, no Vitest or Playwright, and
the only tests were Polar-oriented `bun:test` mocks. The tracker was reset.

## Phases

### Phase 0 — Repository Audit
Status: COMPLETED

- [x] Inspect Relivator
- [x] Inspect git status and preserve existing changes
- [x] Identify auth and DB setup
- [x] Identify Polar dependencies
- [x] Identify reusable components
- [x] Identify existing test infrastructure
- [x] Document technical risks
- [x] Deliver docs/architecture.md
- [x] Deliver docs/implementation-plan.md

#### Verification
Documentation phase; findings verified by direct inspection of the working tree on 2026-10-27 (git status/log, package.json, src/, .tests/, Docker files, upstream Relivator package.json). No tests apply.

### Phase 1 — Foundation
Status: COMPLETED
Plan: docs/superpowers/plans/2026-10-27-gillu-phase-0-1-foundation.md

- [x] Safely remove Polar
- [x] Set up PostgreSQL
- [x] Validate Drizzle
- [x] Configure Docker
- [x] Configure Vitest
- [x] Configure Playwright
- [x] Create migration workflow
- [x] Verify production build
- [x] Deliver: running application with working authentication

#### Baseline
Recorded 2026-10-27 on `gillu/phase-0-1` after `bun install --frozen-lockfile` (bun 1.4.4, Node 26.7), before any Phase 1 code change:

| Check | Result |
|---|---|
| `bun run typecheck` | PASS (exit 0) |
| `bun run lint` (eslint) | FAIL — 59 problems (52 errors, 7 warnings). Files: `.tests/*.ts` (parse error: not in tsconfig project), `next.config.ts`, Polar files (`src/api/payments/service.ts`, `src/app/api/payments/*`, `src/app/dashboard/billing/page.client.tsx`, `src/ui/components/payments/PaymentForm.tsx`), `src/db/schema/index.ts`, `src/lib/auth.ts`, `src/lib/queries/uploads.ts`, `src/ui/components/product-card.tsx` — mostly perfectionist sort order |
| `bunx biome check .` | FAIL — 16 errors (formatting + `useImportType`), same Polar files plus `src/lib/auth.ts`, `src/lib/queries/uploads.ts`, `src/ui/components/{product-card,notifications/notification-center,notifications/notifications}.tsx`, `.tests/*` |
| `bun run knip` | FAIL — unused files `.tests/*`, `src/ui/components/banners/u24.tsx`; unused Polar exports in `src/api/payments/service.ts`; hint: `zod` listed in ignoreDependencies but unused |
| `bun run build` (placeholder env) | PASS (exit 0). Logged non-fatal errors: GitHub-stars fetch to `regh.reliverse.org` (ENOTFOUND) and `getUsersWithUploads` DB connection refused during build |
| `bun run test:e2e` (auth smoke, pre-upgrade) | FAIL 1/2 — `sign up, sign in and sign out` fails. Root cause: Polar plugin `createCustomerOnSignUp` calls Polar without a token; `POST /api/auth/sign-up/email` returns HTTP 500 `POLAR_CUSTOMER_CREATION_FAILED … Status 401 Unauthorized`. Masked in the UI because the sign-up and sign-in pages treat better-auth's `{ error }` result as success and redirect anyway. `wrong password does not create a session` passes. |

#### Verification
Run 2026-10-27 on `gillu/phase-0-1` (gate, Task 11):

| Check | Result |
|---|---|
| `bun run typecheck` | PASS |
| `bun run lint` (ESLint + Biome, 150 files) | PASS |
| `bun run knip` | PASS |
| `bun run test:unit` | PASS — 18/18 |
| `bun run test:integration` (Testcontainers Postgres 16) | PASS — 8/8 |
| `bun run test:e2e` (Playwright, Chromium) | PASS — 8/8 |
| `bun run build` (Next.js 16.4.3) | PASS |
| Compose smoke (`docker compose up --build -d --wait`) | PASS — all services healthy; `GET http://127.0.0.1:8080/api/health` → 200 `{"checks":{"database":"ok"},"status":"ok"}` with `x-request-id` echoed; `migrate` exited 0; only nginx publishes a port; web runs as uid 1000 (`node`) |
| Security boundaries | `/admin/*`: signed-out → sign-in, non-admin → 404, CLI-granted admin → 200 (E2E). No non-`NEXT_PUBLIC_` env in client components. Postgres/Redis publish no ports. nginx overwrites `X-Forwarded-For` (rate-limit bypass prevention). |

### Phase 2 — Merchant Authentication
Status: NOT_STARTED

- [ ] Google OAuth (NEEDS_INPUT: Google OAuth client id/secret for manual verification)
- [ ] Merchant membership
- [ ] Merchant onboarding
- [ ] Role authorization
- [ ] Merchant approval
- [ ] Merchant profile
- [ ] Pickup addresses
- [ ] Deliver: merchant can register and access an approved dashboard

### Phase 3 — Product Management
Status: NOT_STARTED

- [ ] Categories
- [ ] Product CRUD
- [ ] Product images
- [ ] Product status
- [ ] Inventory
- [ ] Stock adjustment
- [ ] Merchant product management UI
- [ ] Deliver: approved merchant can publish real products

### Phase 4 — Customer Storefront
Status: NOT_STARTED

- [ ] Integrate Gillu landing-page source (NEEDS_INPUT: landing-page source/assets)
- [ ] Fetch products from DB
- [ ] Product detail pages
- [ ] Merchant shop pages
- [ ] Search and filters
- [ ] Cart
- [ ] Customer login
- [ ] Deliver: products from multiple merchants visible and purchasable up to checkout entry

### Phase 5 — Internal Order System
Status: NOT_STARTED

- [ ] Customer addresses
- [ ] Checkout validation
- [ ] Multi-merchant suborders
- [ ] Inventory reservations
- [ ] Order lifecycle
- [ ] Idempotency
- [ ] Merchant order notifications
- [ ] Deliver: customer can place an internal test order without an external payment provider

### Phase 6 — Cashfree
Status: NOT_STARTED

- [ ] Payment adapter
- [ ] Sandbox checkout (NEEDS_INPUT: Cashfree sandbox app id/secret)
- [ ] Verified webhooks
- [ ] Payment state reconciliation
- [ ] COD processing
- [ ] Payment worker
- [ ] Deliver: prepaid and COD checkout work within their tested environments

### Phase 7 — Shiprocket
Status: NOT_STARTED

- [ ] Shipping adapter
- [ ] Pickup location validation
- [ ] Courier serviceability (NEEDS_INPUT: Shiprocket sandbox login)
- [ ] Shipping order creation
- [ ] AWB
- [ ] Labels
- [ ] Pickup
- [ ] Tracking
- [ ] Shipping worker
- [ ] Deliver: merchant can prepare and dispatch orders via the supported Shiprocket sandbox workflow

### Phase 8 — Merchant Dashboard Completion
Status: NOT_STARTED

- [ ] New orders
- [ ] Packaging workflow
- [ ] Shipment timeline
- [ ] Shipping exceptions
- [ ] Basic sales metrics
- [ ] Reviews
- [ ] Notifications
- [ ] Deliver: merchant can operate fulfillment from the dashboard

### Phase 9 — E2E Hardening
Status: NOT_STARTED

- [ ] Full Playwright journeys (Scenarios A–J)
- [ ] Security tests
- [ ] Database concurrency tests
- [ ] Provider failure tests
- [ ] Responsive UI verification
- [ ] Deployment smoke tests
- [ ] Release documentation cleanup
- [ ] Deliver: verified end-to-end marketplace MVP

## Blockers

None for Phases 0–1 (both COMPLETED).

Open inputs (NEEDS_INPUT, block only the phase named):
- Google OAuth client id/secret — Phase 2 manual verification
- Gillu landing-page source/assets — Phase 4
- Cashfree sandbox app id/secret — Phase 6
- Shiprocket sandbox login — Phase 7
- Compliance fields per merchant type (GSTIN/PAN/FSSAI…) — Phase 2, stored optional and flagged unverified until confirmed

## Phase Reports

(Appended after each phase using the requirements §29 template.)

### Phase 0 report

PHASE: 0 — Repository Audit
STATUS: COMPLETED
FEATURES IMPLEMENTED: none (documentation phase)
FILES CHANGED: diagrams/approved-architecture.txt, diagrams/implementation-progress.md, diagrams/decisions.md, docs/architecture.md, docs/implementation-plan.md, docs/decisions.md, docs/implementation-progress.md, skeletons docs/{database-design,api-contracts,merchant-workflow,order-lifecycle,testing,deployment}.md, docs/integrations/{cashfree,shiprocket}.md, docs/superpowers/specs + plans
TESTS EXECUTED: none — no code changed
TEST RESULTS: n/a
KNOWN ISSUES: previous tracker claims were false (see Audit Notes); /admin/summary lacks an admin-role check (fixed in Phase 1); storefront uses mock data (Phase 4)
BLOCKERS: none
NEXT PHASE: 1 — Foundation

### Phase 1 report

PHASE: 1 — Foundation
STATUS: COMPLETED
FEATURES IMPLEMENTED:
- Polar removed (plugin, SDK, routes, service, schema, billing page, payment form, env vars, docs)
- Upgraded Next.js 16.4.3, React 19.3.1, better-auth 1.7.14, drizzle-orm 0.45.4, drizzle-kit 0.31.11, Zod 4.6, TypeScript 5.9.3
- Generated Drizzle migrations (0000 baseline, 0001 admin columns) + `runMigrations()`
- Admin role via better-auth admin plugin; `requireSession`/`requireAdmin`; `/admin/*` hidden (404) from non-admins; `admin:grant` CLI
- Auth pages now surface better-auth errors (previously redirected on failure); sign-up lands signed in (better-auth autoSignIn)
- Zod 4 server env validation; pino JSON logger; `x-request-id` correlation via `src/proxy.ts` and nginx; `/api/health` (200/503, 2 s timeout)
- Docker Compose: postgres, redis, one-shot migrate, web, nginx
- Vitest (unit + Testcontainers integration), Playwright E2E on a throwaway database
FILES CHANGED: see `git log main..gillu/phase-0-1`; main areas: src/lib/auth*.ts, src/platform/*, src/modules/identity/*, src/proxy.ts, src/app/api/health, src/app/admin/layout.tsx, src/app/auth/*, src/db/*, drizzle/*, tests/*, scripts/*, docker-compose*.yml, Dockerfile, deploy/nginx, docs/*, diagrams/*
TESTS EXECUTED: typecheck, lint, knip, unit, integration, E2E, production build, Compose smoke
TEST RESULTS: unit 18/18, integration 8/8, E2E 8/8; typecheck/lint/knip/build pass; Compose smoke pass
KNOWN ISSUES:
- Storefront still renders Relivator mock data (Phase 4)
- Google OAuth not exercised: no credentials (Phase 2 manual verification)
- `/dashboard/*` starter pages remain until Gillu equivalents exist
- E2E serves with `next start`, which warns under `output: standalone` (containers use `node server.js`)
- No TLS in the shipped nginx config; Redis has no password (internal network only)
BLOCKERS: none
NEXT PHASE: 2 — Merchant Authentication (needs Google OAuth credentials only for its manual Google verification)
