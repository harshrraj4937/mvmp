# Gillu Implementation Progress

Canonical tracker. `docs/implementation-progress.md` points here.
Rule: a phase is COMPLETED only after its verification commands were run in a
session and passed (requirements §29). Status values: NOT_STARTED,
IN_PROGRESS, COMPLETED, BLOCKED, NEEDS_INPUT.

## Current Phase
Phase 1 — Foundation

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
Status: NOT_STARTED
Plan: docs/superpowers/plans/2026-10-27-gillu-phase-0-1-foundation.md

- [ ] Safely remove Polar
- [ ] Set up PostgreSQL
- [ ] Validate Drizzle
- [ ] Configure Docker
- [ ] Configure Vitest
- [ ] Configure Playwright
- [ ] Create migration workflow
- [ ] Verify production build
- [ ] Deliver: running application with working authentication

#### Baseline
Recorded 2026-10-27 on `gillu/phase-0-1` after `bun install --frozen-lockfile` (bun 1.4.4, Node 26.7), before any Phase 1 code change:

| Check | Result |
|---|---|
| `bun run typecheck` | PASS (exit 0) |
| `bun run lint` (eslint) | FAIL — 59 problems (52 errors, 7 warnings). Files: `.tests/*.ts` (parse error: not in tsconfig project), `next.config.ts`, Polar files (`src/api/payments/service.ts`, `src/app/api/payments/*`, `src/app/dashboard/billing/page.client.tsx`, `src/ui/components/payments/PaymentForm.tsx`), `src/db/schema/index.ts`, `src/lib/auth.ts`, `src/lib/queries/uploads.ts`, `src/ui/components/product-card.tsx` — mostly perfectionist sort order |
| `bunx biome check .` | FAIL — 16 errors (formatting + `useImportType`), same Polar files plus `src/lib/auth.ts`, `src/lib/queries/uploads.ts`, `src/ui/components/{product-card,notifications/notification-center,notifications/notifications}.tsx`, `.tests/*` |
| `bun run knip` | FAIL — unused files `.tests/*`, `src/ui/components/banners/u24.tsx`; unused Polar exports in `src/api/payments/service.ts`; hint: `zod` listed in ignoreDependencies but unused |
| `bun run build` (placeholder env) | PASS (exit 0). Logged non-fatal errors: GitHub-stars fetch to `regh.reliverse.org` (ENOTFOUND) and `getUsersWithUploads` DB connection refused during build |

#### Verification
Not yet run.

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

None for Phases 0–1.

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
