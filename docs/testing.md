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
| E2E | `bun run test:e2e` | `tests/e2e/**` | `scripts/e2e.ts`: throwaway Postgres (tmpfs, `127.0.0.1:54329`) → `db:migrate` → `next build` → Playwright against `next start` on `:3100` → tear down. Product images use `IMAGE_STORAGE_DRIVER=local` in a fresh temp directory. One file: `bun run test:e2e -- tests/e2e/<file>.spec.ts` |
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
`seedMerchant`, parsed `onboarding()`), `tests/integration/support/catalog.ts`
(`seedApprovedMerchant`, `seedCategory`, parsed `productInput()`,
`addImageRow` for an image row without a file), `tests/fixtures/images/`
(1×1 JPEG/PNG/GIF and a 3×2 WebP). E2E `approvedMerchant(browser, page,
storeName)` signs up, onboards, submits and has an admin approve the shop.

## Current coverage (Phases 1–3)

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
| `tests/unit/gillu/scoped-css.test.ts` | ported site/desk CSS rules sit inside `@scope` (except keyframes/root rules); desk CSS has no demo-only rules |
| `tests/unit/catalog/money.test.ts` | rupee input ("₹1,299.50", "1,00,000") → exact paise with string maths; refuses negatives, 3 decimals, over one crore; en-IN formatting |
| `tests/unit/catalog/sku.test.ts` | trim + uppercase; allowed characters and length |
| `tests/unit/catalog/product-status.test.ts` | every allowed and refused transition; `invalid_transition`; guarded-update source states |
| `tests/unit/catalog/publishability.test.ts` | category/variant/image blockers in order |
| `tests/unit/catalog/schemas.test.ts` | product/variant/stock/image/list-query schemas: rupee strings, blank MRP absent vs cleared, MRP ≥ price on `mrp`, whole numbers, delta ≠ 0, unknown status refused |
| `tests/unit/catalog/image-type.test.ts` | JPEG/PNG/WebP by magic bytes; HTML, SVG, GIF, RIFF-not-WebP, truncated PNG, empty refused |
| `tests/unit/platform/http.test.ts` (Phase 3 additions) | nested errors under dotted keys (`variant.price`); `parseQuery` parsing and 400 |
| `tests/integration/catalog/categories.test.ts` | seeded categories in order; admin create with slug; duplicate in any case and rename onto another name → `category_exists`; hidden from merchants not admins; rename keeps slug; reorder; unknown id 404 |
| `tests/integration/catalog/products.test.ts` | create with default variant + INITIAL movement; another shop → 404; `sku_taken`; slug suffix and `slug_locked`; archived read-only; variants (`label_required`, `last_variant`, price above stored MRP refused on `mrp`); search by name/SKU, archived hidden; counts by status, out of stock, low stock ≤ 5 |
| `tests/integration/catalog/inventory.test.ts` | adjustments + movements with actor; `insufficient_stock` leaves stock unchanged; 20 concurrent −1 on 10 → exactly 10 succeed, never negative |
| `tests/integration/catalog/images.test.ts` | WebP stored with size/dimensions; alt default; HTML named .jpg refused, nothing stored; 4 MB + 1 refused; ninth image refused; edit alt/order; delete removes row and file; another shop → 404; storage unavailable without token; local in production needs the flag; path-escaping keys refused |
| `tests/integration/catalog/status.test.ts` | publish blockers (`details.missing`); publish/unpublish/republish/archive; archived final; concurrent publishes → one wins; publish vs archive; draft or since-suspended shop → 403; admin hold blocks republish, release leaves UNPUBLISHED, `no_hold`; held product archivable; admin list by status; hold reason 5–500 |
| `tests/integration/catalog/purchasable.test.ts` | excludes draft, unpublished, archived, held, out-of-stock, switched-off-variant, hidden-category and suspended-shop products; price-from over in-stock active variants; category filter and limit; hiding a category removes the product and blocks republish |
| `tests/e2e/landing.spec.ts` | every section renders without demo wording; collection filter and product dialog; festival tabs by keyboard; early access collects nothing, "Start selling" → onboarding; phone width: no horizontal scroll, mobile nav closes after a choice |
| `tests/e2e/desk.spec.ts` | approved desk nav (no demo items), `/` focuses search; draft shop sees no Products link or search; mobile nav toggle |
| `tests/e2e/catalog-api.spec.ts` | 401/403 (no shop, draft shop); create with "₹1,299", labelled variants, PNG upload served with nosniff, stock +5 and −999 (409), movements, publish; `?status` validated; disguised text upload `invalid_image`, non-multipart 400; another shop → 404 on read/edit/publish/stock/image delete; admin hold → `admin_hold`, non-admin 403, release; suspended shop → 403 |
| `tests/e2e/merchant-products.spec.ts` | create → blockers → upload → publish → card "₹1,299", "12 in stock"; no-results search; add variant (names the first) and failed −5 adjustment; MRP below price field error; overview counts; archive confirm is final; draft shop redirected |
| `tests/e2e/admin-catalog.spec.ts` | categories add/duplicate/hide; non-admin 404/403 (HTML, forged RSC); public list; admin pauses a product → merchant sees reason, publish refused → release → republish; non-admin cannot see `/admin/products` |
| `tests/e2e/health.spec.ts` | `/api/health` ok + request id echo + no-store; pages get a generated request id |

Deployment smoke (manual, Phases 1–3): `docker compose up --build -d --wait`, then
`curl -H 'x-request-id: compose-smoke-0001' http://127.0.0.1:8080/api/health`,
`curl http://127.0.0.1:8080/api/v1/merchant/profile` (401 JSON with
`requestId`), `curl http://127.0.0.1:8080/` (Gillu landing) and
`curl http://127.0.0.1:8080/api/v1/categories` (7 seeded categories).

## Not yet covered

UploadThing image storage against the real service (needs a token; the
adapter is code complete). Provider contract/sandbox suites (Phases 6–7) and Scenarios B–J (from the
phase that makes each possible; Scenario A is covered from Phase 2). Google
OAuth is not automatable; it will be verified manually once credentials
exist.
