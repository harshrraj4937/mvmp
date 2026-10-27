# Gillu Implementation Progress

Canonical tracker. `docs/implementation-progress.md` points here.
Rule: a phase is COMPLETED only after its verification commands were run in a
session and passed (requirements §29). Status values: NOT_STARTED,
IN_PROGRESS, COMPLETED, BLOCKED, NEEDS_INPUT.

## Current Phase
Phase 3 — Product Management (not started). Phase 2 COMPLETED on `gillu/phase-2` (not merged).

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

Final review fix pass, 2026-10-27 (same branch):

| Check | Result |
|---|---|
| Finding: `/admin/summary` leaked every user's email to a non-admin — in the 404 page's HTML and in a forged RSC request — because only the layout checked the role | FIXED — page and `getUsersWithUploads()` now call `requireAdmin()`; E2E `non-admin never receives other users' data from admin pages` RED→GREEN |
| Finding: logger left top-level `password`/`token`/… keys in clear | FIXED — unit `logger.test.ts` RED→GREEN |
| Finding: `db:auth` could silently drop a table after a relations block; CLI unpinned | FIXED — unit `auth-db-transform.test.ts` RED→GREEN; CLI pinned to installed better-auth; regenerated schema byte-identical |
| Finding: README still said `db:push` | FIXED (docs) |
| `bun run typecheck` / `lint` / `knip` | PASS |
| `bun run test` (unit 21 + integration 8) | PASS — 29/29 |
| `bun run test:e2e` (includes production build) | PASS — 9/9 |

### Phase 2 — Merchant Authentication
Status: COMPLETED (Google OAuth: code complete; manual verification NEEDS_INPUT)
Plan: docs/superpowers/plans/2026-10-27-gillu-phase-2-merchant-auth.md
Branch: `gillu/phase-2` (from `gillu/phase-0-1` @ d62c582)

- [x] Google OAuth — code complete and unit-tested (buttons only when id + secret set, `prompt: select_account`, profile name mapping, safe `?next=`). **Manual verification NEEDS_INPUT (Google OAuth credentials); not verified against Google.**
- [x] Merchant membership — `merchant_members` (owner/staff), one owned shop per user (partial unique index), owner-first resolution
- [x] Merchant onboarding — API + `/merchant/onboarding` UI; one transaction (shop, owner, primary pickup); duplicate/racing onboarding → one shop
- [x] Role authorization — `authorizeSession/Admin/Merchant` (API), `requireSession/Admin/Merchant/ApprovedMerchant` (pages); every page/handler authorizes itself
- [x] Merchant approval — admin queue and detail (`/admin/merchants`), approve/reject (reason shown to merchant)/suspend/reinstate; guarded concurrent transitions
- [x] Merchant profile — `/merchant/profile`; locked fields after approval; compliance ids optional and "Unverified"
- [x] Pickup addresses — `/merchant/settings/shipping`; primary handling; cross-merchant ids → 404
- [x] Deliver: merchant can register and access an approved dashboard (E2E Scenario A)

#### Verification
Run 2026-10-27 on `gillu/phase-2` (gate, Task 10):

| Check | Result |
|---|---|
| `bun run typecheck` | PASS |
| `bun run lint` (ESLint + Biome) | PASS |
| `bun run knip` | PASS |
| `bun run test:unit` | PASS — 96/96 (11 files) |
| `bun run test:integration` (Testcontainers Postgres 16) | PASS — 39/39 (7 files) |
| `bun run test:e2e` (Playwright, Chromium, includes production build) | PASS — 26/26 |
| Compose smoke (isolated project `gillu-smoke`, port 18080, throwaway env) | PASS — all services healthy; `migrate` exited 0; `drizzle.__drizzle_migrations` has 3 rows and `merchants`, `merchant_members`, `merchant_pickup_locations` exist (0002 applied); `GET /api/health` → 200; `GET /api/v1/merchant/profile` → 401 `{"error":{"code":"unauthorized",…},"requestId":…}` with `no-store`; `down -v` removed only `gillu-smoke_*` volumes. The existing `gillu` stack and `relivator_postgres_data` were not touched. |
| Security boundaries | Non-admin: `/admin/merchants` and `/admin/merchants/[id]` → 404, no merchant contact email in the HTML or in a forged RSC request (now with a router-state tree Next 16 accepts; mutation-tested), admin API → 403. Merchant: shop from membership only; other shop's pickup id → 404; staff cannot edit/submit; suspension applies on the next request. Open redirect: `?next=` same-site paths only. |
| Google OAuth | NOT VERIFIED — no credentials (NEEDS_INPUT) |

Final review fix pass, 2026-10-27 (same branch):

| Check | Result |
|---|---|
| Finding (Critical): open redirect — `?next=%2F%09%2Fevil.com` arrives decoded as `/\t/evil.com`, passed `safeNextPath`, and URL parsing drops the tab → `https://evil.com/`; a newline variant crashed the signed-in server redirect | FIXED — control characters rejected and the path must resolve to the same origin; unit `rejects control characters in …` (5 cases) and E2E `a next path hiding a tab or newline never leaves the site` RED→GREEN |
| Finding (Important): a real double submit (same payload, same slug) answered `409 slug_taken` instead of `already_merchant_owner`; the race test used two different slugs | FIXED — on a slug conflict the service checks whether the caller now owns a shop; integration `double-submitted onboarding creates exactly one merchant` now sends one payload twice, RED (4/4 runs `slug_taken`) → GREEN |
| `bun run typecheck` / `lint` / `knip` | PASS |
| `bun run test:unit` | PASS — 101/101 |
| `bun run test:integration` | PASS — 39/39 |
| `bun run test:e2e` | PASS — 27/27 |

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

None for Phases 0–2 (all COMPLETED; Phase 2 Google sign-in still awaits manual verification).

Open inputs (NEEDS_INPUT, block only the phase named):
- Google OAuth client id/secret — Phase 2 manual verification (code complete)
- Gillu landing-page source/assets — Phase 4
- Cashfree sandbox app id/secret — Phase 6
- Shiprocket sandbox login — Phase 7
- Compliance fields per merchant type (GSTIN/PAN/FSSAI…) — stored optional and shown "Unverified" (`compliance_verified_at` null) until confirmed (ADR-025)

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
- Admin role via better-auth admin plugin; `requireSession`/`requireAdmin`; `/admin/*` hidden (404) from non-admins, checked in layout, page and data function; `admin:grant` CLI
- Auth pages now surface better-auth errors (previously redirected on failure); sign-up lands signed in (better-auth autoSignIn)
- Zod 4 server env validation; pino JSON logger; `x-request-id` correlation via `src/proxy.ts` and nginx; `/api/health` (200/503, 2 s timeout)
- Docker Compose: postgres, redis, one-shot migrate, web, nginx
- Vitest (unit + Testcontainers integration), Playwright E2E on a throwaway database
FILES CHANGED: see `git log main..gillu/phase-0-1`; main areas: src/lib/auth*.ts, src/platform/*, src/modules/identity/*, src/proxy.ts, src/app/api/health, src/app/admin/layout.tsx, src/app/auth/*, src/db/*, drizzle/*, tests/*, scripts/*, docker-compose*.yml, Dockerfile, deploy/nginx, docs/*, diagrams/*
TESTS EXECUTED: typecheck, lint, knip, unit, integration, E2E, production build, Compose smoke
TEST RESULTS: unit 21/21, integration 8/8, E2E 9/9 (after final-review fix pass); typecheck/lint/knip/build pass; Compose smoke pass
KNOWN ISSUES:
- Storefront still renders Relivator mock data (Phase 4)
- Google OAuth not exercised: no credentials (Phase 2 manual verification)
- `/dashboard/*` starter pages remain until Gillu equivalents exist
- E2E serves with `next start`, which warns under `output: standalone` (containers use `node server.js`)
- No TLS in the shipped nginx config; Redis has no password (internal network only)
BLOCKERS: none
NEXT PHASE: 2 — Merchant Authentication (needs Google OAuth credentials only for its manual Google verification)

### Phase 2 report

PHASE: 2 — Merchant Authentication
STATUS: COMPLETED (Google OAuth code complete; manual verification NEEDS_INPUT)
FEATURES IMPLEMENTED:
- Google/GitHub sign-in buttons only for configured providers; Google `prompt: select_account`; profile → first/last name; `?next=` carried through sign-in/sign-up, same-site paths only
- `/api/v1` error contract (`{ data }` / `{ error: { code, message, details? }, requestId }`, `no-store`) via `apiRoute()` (ADR-022)
- Merchants module (domain/application/presentation): statuses DRAFT → SUBMITTED → APPROVED/REJECTED, APPROVED ⇄ SUSPENDED; guarded transitions; one owned shop per user (ADR-023); locked fields after approval (ADR-024); optional, unverified compliance ids (ADR-025); Indian phone/PIN normalisation; reserved slugs
- Migration 0002 (additive): `merchants`, `merchant_members`, `merchant_pickup_locations`
- Merchant API: onboarding, profile GET/PATCH, submit, pickup locations list/add/update
- Admin API: review queue with status filter, detail, approve/reject/suspend/reinstate
- Pages: `/merchant/{onboarding,profile,settings/shipping,dashboard}`, `/admin/merchants`, `/admin/merchants/[id]`; `/admin` → `/admin/merchants`; header "Sell on Gillu"
- Final review fixes: `?next=` open redirect via tab/newline closed; double-submitted onboarding reports `already_merchant_owner`
- Forged-RSC leak checks now use a router-state tree Next 16 accepts (the Phase 1 check was vacuous) and assert an RSC response
FILES CHANGED: `git diff --stat d62c582..gillu/phase-2` (77 files before this report); main areas: src/modules/merchants/**, src/modules/identity/index.ts, src/platform/{errors,http,db-errors}.ts, src/lib/{auth,auth-social,safe-next-path,api-client}.ts, src/db/schema/merchants/*, drizzle/0002_*, src/app/api/v1/**, src/app/merchant/**, src/app/admin/{page,layout}.tsx, src/app/admin/merchants/**, src/app/auth/{sign-in,sign-up}/*, src/ui/components/{auth/social-sign-in,header/header}.tsx, tests/**, docs/*, diagrams/*
TESTS EXECUTED: typecheck, lint, knip, unit, integration (Testcontainers), E2E (production build), Compose smoke
TEST RESULTS: unit 101/101, integration 39/39, E2E 27/27 after the final-review fix pass (gate before it: 96/39/26); typecheck/lint/knip pass; Compose smoke pass (0002 applied, health 200, merchant API 401 JSON with requestId)
KNOWN ISSUES:
- Google OAuth not exercised against Google (no credentials)
- Staff memberships exist only via the database; invitations and a shop switcher come later
- No admin screen to change locked fields or to mark compliance verified
- Logo is an https URL field; uploads arrive with the catalog (Phase 3)
- Dashboard shows no sales/product figures until those phases exist (no mock data)
- No email notifications on review decisions; merchants check `/merchant/onboarding`
- Deferred review minors: pickup PATCH cannot clear `line2`; address change detection is key-order sensitive (harmless today); review-action responses documented as admin detail but return the profile; `/admin` redirect page does not call `requireAdmin()` itself; nested pickup field errors collapse to one message
BLOCKERS: none (Google credentials block only the manual Google check)
NEXT PHASE: 3 — Product Management
