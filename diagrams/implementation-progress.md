# Gillu Implementation Progress

Canonical tracker. `docs/implementation-progress.md` points here.
Rule: a phase is COMPLETED only after its verification commands were run in a
session and passed (requirements §29). Status values: NOT_STARTED,
IN_PROGRESS, COMPLETED, BLOCKED, NEEDS_INPUT.

## Current Phase
Phase 6 — Cashfree (not started). Phase 5 COMPLETED on `gillu/phase-5` (not merged); Phase 4 COMPLETED on `gillu/phase-4` (not merged); Phase 3 COMPLETED on `gillu/phase-3` (not merged); Phase 2 COMPLETED on `gillu/phase-2` (not merged).

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
Status: COMPLETED
Branch: `gillu/phase-3` (from `gillu/phase-2` @ 955c722). Also ports the Gillu UI (landing page, merchant desk) from `/opt/NH/gillu`.

- [x] Categories — admin-managed (`/admin/categories`, API), seven seeded (migration 0004), public list
- [x] Product CRUD — products with a default variant; variants own price/MRP/SKU/pack size/stock (ADR-027); tenant isolation (other shop → 404)
- [x] Product images — JPEG/PNG/WebP by magic bytes, ≤ 4 MB, ≤ 8; `ImageStorage` port with local and UploadThing drivers (ADR-029). **UploadThing: manually verified by the user on 2026-10-28 (uploads work against UploadThing).**
- [x] Product status — direct publish for approved shops, guarded transitions, publish blockers, admin hold/release (ADR-028)
- [x] Inventory — `inventory` + append-only `inventory_movements`
- [x] Stock adjustment — guarded `available + delta >= 0` update with movement, never negative under concurrency (ADR-030)
- [x] Merchant product management UI — `/merchant/products`, `/new`, `/[id]` in the Gillu desk; overview metrics from real counts
- [x] Deliver: approved merchant can publish real products (E2E `merchant-products.spec.ts`)
- [x] Gillu UI port — landing at `/`, merchant desk shell and pages, CSS kept in `@scope` (ADR-026)
- [x] `listPurchasableProducts` ready for Phase 4

#### Verification
Run 2026-10-27 on `gillu/phase-3` (gate, Task 13):

| Check | Result |
|---|---|
| `bun run typecheck` | PASS |
| `bun run lint` (ESLint + Biome) | PASS |
| `bun run knip` | PASS |
| `bun run test:unit` | PASS — 198/198 (18 files) |
| `bun run test:integration` (Testcontainers Postgres 16) | PASS — 98/98 (13 files) |
| `bun run test:e2e` (Playwright, Chromium, includes production build) | PASS — 52/52 |
| Compose smoke (isolated project `gillu-smoke`, port 18080, throwaway env) | PASS — all services healthy; `migrate` exited 0; `drizzle.__drizzle_migrations` has 5 rows; catalog tables exist; 7 categories; `GET /` → 200 Gillu landing; `GET /api/v1/categories` → 200 with 7 items; `GET /api/v1/merchant/products` → 401 `{"error":{"code":"unauthorized",…},"requestId":…}` with `no-store`; `/api/health` → 200; `down -v` removed only `gillu-smoke_*` volumes. `gillu_*` and `relivator_postgres_data` volumes still exist. |
| Security boundaries | Catalog API needs an APPROVED shop (401/403, suspension on next request); product/variant/image ids of another shop → 404 (E2E + integration); `/admin/products` and `/admin/categories` → 404 for non-admins, no product names in HTML or forged RSC; admin API → 403; uploads checked by bytes (HTML disguised as JPEG refused); image route refuses path-escaping keys and sends `nosniff`; no secrets in client bundles (storage tokens read server-side only) |
| UploadThing | VERIFIED MANUALLY by the user, 2026-10-28 (real token, uploads working). No automated test runs against the service; uploads answer 503 when no token is set |
| Visual parity | Landing (360/768/1366) and desk pages (overview, products, profile, shipping at 1366/360) compared by screenshot with the source; differences recorded in the plan ledger |

Final review fix pass, 2026-10-27 (same branch; fresh Opus reviewer, no Critical findings):

| Check | Result |
|---|---|
| Finding (Important): spec §5.5 controls missing on the product page — no variant edit, no recent stock movements, no image alt/reorder (a wrong price could not be fixed in the desk) | FIXED — "Edit" variant dialog (only changed fields sent), "Recent stock changes" in the stock dialog, per-photo description and move earlier/later; image `sortOrder` range widened to 0–10000 so reordering works after replacements. E2E `a merchant edits a variant, sees stock history and arranges photos` and unit `positions are not capped at the image limit` RED→GREEN |
| Finding (Important): a published product could lose its last photo (and a publish could race an image delete) | FIXED — `deleteProductImage` locks the product and refuses the last photo of a PUBLISHED product with `409 last_image`; integration `a published product keeps its last image` RED→GREEN |
| `bun run typecheck` / `lint` / `knip` | PASS |
| `bun run test:unit` | PASS — 199/199 |
| `bun run test:integration` | PASS — 99/99 |
| `bun run test:e2e` | PASS — 53/53 |

Deferred minors (not fixed): concurrent same-name create can 500 on the slug constraint; variant patch loads before the product lock (stale MRP check → DB CHECK 500 under concurrency); image upload and stock adjustment re-check ARCHIVED outside the write; upload size precheck trusts Content-Length (bounded today by the proxy's 10 MB body clone); a PUBLISHED but unpurchasable product (hidden category, sold out) shows no notice; variant/image sub-routes ignore the product id in the path; `parseQuery` keeps the last repeated value though its comment says first, and an over-long `q` silently drops both list filters; `scripts/e2e.ts` leaves its temp image directory; the admin moderation table has no link to view the product; no concurrent-upload test for the eighth slot and no HTTP traversal test for the image route.

Note for Phase 4: landing festival/product previews are still illustrative content; the storefront should list from `listPurchasableProducts`.

### Phase 4 — Customer Storefront
Status: COMPLETED
Branch: `gillu/phase-4` (from `gillu/phase-3` @ 48caf71). Not merged. Built on the unmerged Phase 3 branch.

- [x] Fetch products from DB — `/explore` and `/api/v1/products` list purchasable products through `productOnSale()` and `sellableVariant()`, with price from in-stock variants
- [x] Product detail pages — `/shops/[shop]/[product]` with gallery, sizes (sold-out sizes marked), low-stock note, add to cart, maker panel (ADR-033)
- [x] Merchant shop pages — `/shops/[shop]` with the story and purchasable products; a shop shows only with a complete story (ADR-031)
- [x] Search and filters — `/explore`: search text, category, region, made (handmade / homemade), sort, 24 per page, region counts
- [x] Cart — server-side guest cart behind a hashed cookie, merged on sign-in (ADR-032); 10 per line, 30 lines; price-change acknowledgement and stock states; `/cart` page
- [x] Customer login — sign-in and sign-up return to `next`; checkout needs a signed-in shopper (`/checkout`)
- [x] Story and photos — merchant desk story panel and product story fields; migration 0005 (additive)
- [x] Seen-shops cookie — returning visitors see the compact story strip (ADR-034)
- [x] Landing wired to real products — collection shows the newest live products and category links; regions link to explore where they have products; previews remain until the first sale
- [x] Deliver: products from multiple merchants visible and purchasable up to checkout entry (E2E `cart-checkout.spec.ts`, two shops in one cart)

Place order stays disabled until Phase 5 (orders).

#### Verification
Run 2026-10-28 on `gillu/phase-4`:

| Check | Result |
|---|---|
| `bun run typecheck` | PASS |
| `bun run lint` (ESLint + Biome) | PASS |
| `bunx knip` | PASS |
| `bun run test:unit` (Vitest, `.test.ts` and `.test.tsx`) | PASS — 237/237 (25 files) |
| `bun run test:integration` (Testcontainers Postgres 16) | PASS — 146/146 (16 files) |
| `bun run test:e2e` (Playwright, Chromium, includes production build) | PASS — 74/74 (19 files) |
| Compose smoke (isolated project `gillu-smoke`, port 18080, renamed containers, throwaway env) | PASS — `postgres`, `redis`, `web`, `nginx` healthy; `migrate` exited 0; `drizzle.__drizzle_migrations` has 6 rows; `carts`, `cart_items`, `merchant_story_images` exist; `GET /` 200; `GET /explore` 200; `GET /api/v1/products` 200 `{"data":{"items":[],…}}`; `GET /api/v1/cart` 200 empty with `no-store`; `GET /api/v1/shops/nope` 404 JSON with `requestId`; `down -v` removed only `gillu-smoke_*` volumes; `gillu_*` and `relivator_postgres_data` volumes still exist |
| Security boundaries | Cart reads create nothing; cart lines for another guest are unreachable; hidden or unapproved products are 404 on the public API; story and photo writes are scoped to the caller's shop; cart rows locked on write; the guest token is stored only as its SHA-256 hash |

Final review: see the Phase 4 report below.

Plan evaluation fix pass, 2026-10-28 (each fix RED→GREEN):

| Check | Result |
|---|---|
| Finding: the template header on `/auth/sign-in` and `/auth/sign-up` showed a cart with hard-coded sample items ("Premium Wireless Headphones") while a shopper signed in for checkout | FIXED — template cart, its mock data, `CartProvider`/`use-cart`, and the primitives only it used (`sheet`, `drawer`, `use-media-query`, dependency `vaul`) removed; the header links to the real `/cart`. E2E `the sign-in and sign-up pages show no template cart with sample items` |
| Finding: a suspended shop's cart group linked to its shop page, which 404s | FIXED — shop links need APPROVED and a complete story (`linkableShopIds`). Integration `a suspended shop is not linkable…` |
| Finding: a sold-out line linked to its product page, which 404s once no size is in stock | FIXED — `productLinkable` on cart lines; the name links only when the page exists. Integration `a product with no stock left has no page…` and the cart `sold out and short` test |
| Gate after the fixes | typecheck, lint, knip PASS; unit 237/237; integration 148/148; E2E 75/75 |

### Phase 5 — Internal Order System
Status: COMPLETED
Branch: `gillu/phase-5` (from `gillu/phase-4` @ 05a09e3). Not merged. Built on the unmerged Phase 4 branch.
Spec: `docs/superpowers/specs/2026-10-28-gillu-phase-5-orders-design.md`; plan: `docs/superpowers/plans/2026-10-28-gillu-phase-5-orders.md`.

- [x] Customer addresses — up to 10 per shopper, one default, `/account/addresses` and `/api/v1/account/addresses`; the order keeps a snapshot
- [x] Checkout validation — signed-in shopper, address, cash on delivery; the server re-checks every line, the total (`price_changed`) and stock (`insufficient_stock`) inside one transaction; "Pay online" shows "Coming soon" (Cashfree, Phase 6)
- [x] Multi-merchant suborders — one order, one part per shop (`GIL-1001-A`, `-B`), each with its own status and COD amount (ADR-035)
- [x] Inventory reservations — held at placement, released on cancel, written off when the maker cancels "Out of stock"/"Damaged" (ADR-036); Scenario H (last piece) integration test
- [x] Order lifecycle — maker steps NEW → ACKNOWLEDGED → PACKING → READY_FOR_PICKUP; shopper and maker cancel before pickup with reasons; status history; order status derived from parts
- [x] Idempotency — checkout key per checkout page, unique per shopper (ADR-037)
- [x] Merchant order notifications — desk nav "Orders" badge with the NEW count and dashboard "Your orders" metrics (WhatsApp alerts deferred, as agreed)
- [x] Shopper pages — `/orders`, `/orders/[number]` (parcels, cancel), header "My orders" / "Sign out"
- [x] Merchant desk — `/merchant/orders` (tabs, 25 a page), `/merchant/orders/[id]` (items, address, COD amount, history, steps, cancel), "Sign out" in the desk sidebar
- [x] Deliver: a shopper places an internal cash-on-delivery order from a two-shop cart and each maker works its own parcel (E2E `checkout.spec.ts`, `merchant-orders.spec.ts`)

#### Verification
Run 2026-10-28 on `gillu/phase-5`:

| Check | Result |
|---|---|
| `bun run typecheck` | PASS |
| `bun run lint` (ESLint + Biome) | PASS |
| `bunx knip` | PASS |
| `bun run test:unit` (Vitest) | PASS — 249/249 |
| `bun run test:integration` (Testcontainers Postgres 16) | PASS — 192/192 |
| `bun run test:e2e` (Playwright, Chromium, includes production build) | PASS — 84/84 |
| Compose smoke (isolated project `gillu-smoke`, port 18080, renamed containers, throwaway env) | PASS — `postgres`, `redis`, `web`, `nginx` healthy; `migrate` exited 0; `drizzle.__drizzle_migrations` has 7 rows; `customer_addresses`, `orders`, `merchant_orders`, `order_items`, `order_address_snapshots`, `order_status_history`, `inventory_reservations` exist; `order_number_seq` at 1001; `GET /` and `GET /explore` 200; `POST /api/v1/orders`, `GET /api/v1/merchant/orders`, `GET /api/v1/account/addresses` signed out → 401 JSON with `requestId` (`no-store`); `/checkout` signed out → 307 to sign-in with `next`; `down -v` removed only `gillu-smoke_*` volumes; `gillu_*` and `relivator_postgres_data` volumes still exist |
| Security boundaries | Orders, parcels and addresses of another shopper are 404; another shop's part is 404 on the API and the not-found page in the desk; the shop always comes from membership; prices, totals and stock come from the server only (the client's `expectedTotalPaise` can only refuse an order); order, part and inventory rows are locked on every change |

Final review: see the Phase 5 report below.

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

### Phase 3 report

PHASE: 3 — Product Management (with the Gillu UI port)
STATUS: COMPLETED (UploadThing manually verified by the user, 2026-10-28)
FEATURES IMPLEMENTED:
- Gillu landing page at `/` and the Gillu merchant desk for `/merchant/*`, ported from `/opt/NH/gillu` to React/TypeScript with the source CSS kept in `@scope` (ADR-026); starter pages moved to the `(starter)` route group; demo-only behaviour dropped
- Migration 0003 (additive): `categories`, `products`, `product_variants`, `product_images`, `inventory`, `inventory_movements`; 0004 seeds seven categories (`ON CONFLICT DO NOTHING`)
- Catalog module: rupee input → integer paise, SKU rules, admin categories, products with variants (ADR-027), guarded stock adjustments with a movement log (ADR-030), images by magic bytes with local/UploadThing storage (ADR-029), direct publish with blockers and admin hold/release (ADR-028), `listPurchasableProducts`
- API: merchant products/variants/images/stock endpoints behind `authorizeApprovedMerchant`; admin categories and products (hold/release); public categories; local image route; `parseQuery`; nested validation errors under dotted keys
- Pages: `/merchant/products`, `/merchant/products/new`, `/merchant/products/[id]`; overview metrics from real counts; `/admin/categories`, `/admin/products`
FILES CHANGED: `git diff --stat 955c722..gillu/phase-3` (197 files before this report); main areas: src/app/(site)/**, src/app/(starter)/**, src/app/merchant/**, src/app/api/v1/{merchant,admin,categories,images}/**, src/modules/catalog/**, src/modules/merchants/index.ts, src/platform/{env,http}.ts, src/db/schema/catalog/*, drizzle/0003_*, drizzle/0004_*, src/ui/gillu/**, src/css/gillu-{site,desk}.css, public/gillu/*, scripts/e2e.ts, tests/**, docs/*, diagrams/*
TESTS EXECUTED: typecheck, lint, knip, unit, integration (Testcontainers), E2E (production build), Compose smoke
TEST RESULTS: unit 199/199, integration 99/99, E2E 53/53 after the final-review fix pass (gate before it: 198/98/52); typecheck/lint/knip pass; Compose smoke pass (5 migrations, 7 categories, landing 200, catalog API 401 JSON with requestId)
KNOWN ISSUES:
- Uploads answer 503 when `UPLOADTHING_TOKEN` is not set (Compose default driver is `uploadthing`)
- Landing previews (festivals, products) are illustrative until the Phase 4 storefront
- Product card shows no SKU line and raw status text, unlike the source demo
- Deferred final-review minors: see "Final review fix pass" under Phase 3 verification
- Starter `/products` and `/dashboard/*` pages remain until Phase 4 equivalents exist
BLOCKERS: none
NEXT PHASE: 4 — Customer Storefront

### Phase 4 report

PHASE: 4 — Customer Storefront
STATUS: COMPLETED (branch `gillu/phase-4`, not merged)
FEATURES IMPLEMENTED:
- Public storefront: `/explore` (search, category, region, made, sort, pagination, region counts), `/shops/[shop]` (story; strip for returning visitors), `/shops/[shop]/[product]` (gallery, sizes, add to cart, maker panel)
- Public API: `GET /api/v1/products`, `GET /api/v1/shops/[shop]`, `GET /api/v1/shops/[shop]/products/[product]`
- Cart: server-side guest cart (hashed `gillu_cart` cookie, ADR-032), lines capped at 10 and 30, merge on sign-in, `GET/POST /api/v1/cart`, `PATCH/DELETE /api/v1/cart/items/[variantId]`, `/cart` page with stock and price states
- Checkout entry: `/checkout` for signed-in shoppers, read-only lines, Place order disabled until Phase 5
- Shop story: merchant desk story panel, shop story photos (up to 6), `/api/v1/merchant/story*`, `shop_story` publish blocker, `story_required` and `last_story_image` (ADR-031)
- Product story fields: made by, made how (handmade / homemade), origin, composition, with category-based composition labels
- Landing: real products and categories once any shop sells; region cards link to explore or read "Coming soon"; hero action to explore
- Migration 0005 (additive): `carts`, `cart_items`, `merchant_story_images`; new columns on `categories`, `products`, `merchants`; two enums
FILES CHANGED: `git diff --shortstat gillu/phase-3..gillu/phase-4` — 121 files, +11,638 / −1,585 (15 commits before the docs commit); main areas: `src/app/(site)/**`, `src/app/api/v1/{cart,products,shops,merchant/story}/**`, `src/modules/{cart,catalog,merchants}/**`, `src/ui/gillu/{site,store,desk}/**`, `src/css/gillu-*.css`, `drizzle/0005_*`, `tests/**`, `docs/*`, `diagrams/*`
TESTS EXECUTED: typecheck, lint, knip, unit, integration (Testcontainers), E2E (production build), Compose smoke (project `gillu-smoke`)
TEST RESULTS: unit 237/237, integration 146/146, E2E 74/74; typecheck, lint, knip pass; Compose smoke pass (6 migrations, new tables, storefront and cart endpoints, `down -v` for `gillu-smoke` only)
FINAL REVIEW: self-review by the author (no reviewer subagent dispatched). Checked: raw SQL (check constraints only), HTML injection (none), cart cookie flags and JSON-only writes, story routes scoped to the caller's shop (`authorizeMerchant`), public shop payload (story, photos, products only). No Critical or Important findings.
KNOWN ISSUES:
- Checkout cannot place an order; Phase 5 adds orders and reservations (`inventory.reserved` is untouched)
- A cart is per browser until the shopper signs in; no cart sharing across devices
- Landing previews stay visible until the first product is on sale
- `/dashboard/*` starter pages remain (see architecture known gaps)
- Google sign-in is code complete but not verified against Google (needs credentials, as in Phase 2)
BLOCKERS: none
NEXT PHASE: 5 — Internal Order System

### Phase 5 report

PHASE: 5 — Internal Order System
STATUS: COMPLETED (branch `gillu/phase-5`, not merged)
FEATURES IMPLEMENTED:
- Shopper addresses: `/account/addresses`, `GET/POST /api/v1/account/addresses`, `PATCH/DELETE /api/v1/account/addresses/[id]`
- Checkout: delivery address (pick or add), cash on delivery, summary with free delivery, Place order → `/orders/<n>?placed=1`
- Orders: `POST/GET /api/v1/orders`, `GET /api/v1/orders/[number]`, `POST /api/v1/orders/[number]/cancel`; one order, one part per shop, item and address snapshots, status history, idempotent checkout key
- Stock: reserve at placement, release on cancel, write-off for maker "Out of stock"/"Damaged"; "N held for orders" on the product page
- Shopper pages: `/orders`, `/orders/[number]` with parcel cancel; header "My orders" and "Sign out"
- Merchant desk: `/merchant/orders` and `/merchant/orders/[id]`, steps and cancel with reasons, nav badge, dashboard order metrics, "Sign out"; `GET /api/v1/merchant/orders`, `GET /api/v1/merchant/orders/[id]`, `POST …/status`, `POST …/cancel`
- Migration 0006 (additive): seven enums, `order_number_seq`, seven tables, two new stock movement reasons
FILES CHANGED: `git diff --shortstat gillu/phase-4..gillu/phase-5` before the docs commit — 81 files, +10,214 / −47 (12 commits); main areas: `src/modules/orders/**`, `src/modules/catalog/application/reservations.ts`, `src/modules/cart/application/checkout-cart.ts`, `src/app/api/v1/{orders,account,merchant/orders}/**`, `src/app/(site)/{checkout,orders,account}/**`, `src/app/merchant/orders/**`, `src/ui/gillu/{store,desk}/**`, `drizzle/0006_*`, `tests/**`, `docs/*`, `diagrams/*`
TESTS EXECUTED: typecheck, lint, knip, unit, integration (Testcontainers), E2E (production build), Compose smoke (project `gillu-smoke`)
TEST RESULTS: unit 249/249, integration 192/192, E2E 84/84; typecheck, lint, knip pass; Compose smoke pass (7 migrations, new tables, order endpoints 401 signed out, `down -v` for `gillu-smoke` only)
FINAL REVIEW: self-review by the author (no reviewer subagent dispatched); findings in the Phase 5 ledger and the hand-off message.
KNOWN ISSUES:
- Cash on delivery only; "Pay online" waits for Cashfree (Phase 6)
- Parcels stop at "Packed — waiting for pickup"; pickup, delivery and stock consumption arrive with Shiprocket (Phase 7)
- No WhatsApp or email alert for a new order; the desk badge and dashboard count only
- A desk URL for another shop's part renders the not-found page with HTTP 200 (streamed behind `merchant/loading.tsx`, as for products since Phase 3); no data is shown
- Google sign-in is code complete but not verified against Google (needs credentials, as in Phase 2)
BLOCKERS: none
NEXT PHASE: 6 — Cashfree
