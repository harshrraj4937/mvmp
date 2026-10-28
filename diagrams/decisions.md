# Gillu Architecture Decisions

Canonical ADR log. `docs/decisions.md` points here.
Source: approved design `docs/superpowers/specs/2026-10-27-gillu-marketplace-design.md` §4.

---

## ADR-001: Drizzle ORM on PostgreSQL

Status: Accepted
Date: 2026-10-27

Decision: Use Drizzle ORM with PostgreSQL as the single source of truth.

Reason: Existing Relivator integration; SQL-oriented queries; strong TypeScript
types; avoids an unnecessary ORM migration.

Alternatives: Prisma, TypeORM (rejected by requirements §3).

---

## ADR-002: Modular monolith

Status: Accepted
Date: 2026-10-27

Decision: One Next.js application organised into domain modules under
`src/modules/` (identity, merchants, catalog, inventory, cart, checkout,
orders, payments, fulfillment, finance, reviews, notifications). Each module
owns its tables and exposes a public interface via `index.ts`.

Reason: Simple transactions across the order flow; low operational cost;
modules can be extracted later.

Alternatives: Microservices with separate databases (out of scope, requirements §27).

---

## ADR-003: Separate worker processes, transactional outbox, BullMQ

Status: Accepted
Date: 2026-10-27

Decision: Business transactions insert `outbox_events` rows; a dedicated
outbox dispatcher enqueues BullMQ jobs (jobId = outbox id); dedicated payment
and shipping workers process them idempotently. Workers share the codebase
and database with the web app and call application services.

Reason: Durable async events without distributed transactions; queues are not
exactly-once, so persisted intent + idempotency keys make provider calls
reconcilable.

---

## ADR-004: Cashfree for prepaid payments

Status: Accepted
Date: 2026-10-27

Decision: Cashfree Payment Gateway behind a `PaymentProvider` port
(`CashfreePaymentProvider`, `MockPaymentProvider`). Sandbox first. Orders are
confirmed only after server-side verification (webhook + status lookup),
never from a frontend callback.

---

## ADR-005: Shiprocket for logistics

Status: Accepted
Date: 2026-10-27

Decision: Shiprocket behind a `ShippingProvider` port
(`ShiprocketShippingProvider`, `MockShippingProvider`). Platform-managed
account with merchant-specific pickup locations. Sandbox first.

Reason: Single integration for courier serviceability, AWB, labels, pickup and
tracking. Account model must be verified with Shiprocket before production.

---

## ADR-006: better-auth with Google, admin plugin, membership-based merchant role

Status: Accepted
Date: 2026-10-27

Decision: better-auth for authentication (email+password, Google OAuth).
ADMIN = better-auth admin plugin (`user.role` contains `admin`), granted only
via the `admin:grant` CLI script — no self-service admin. CUSTOMER = any
authenticated user. MERCHANT = membership row in `merchant_members`
(`owner` | `staff`); selling also requires merchant status `APPROVED`.

Reason: Users can be both customer and merchant; merchants can have several
members; authorization stays server-side.

---

## ADR-007: Remove Polar

Status: Accepted
Date: 2026-10-27

Decision: Remove the Polar subscription integration entirely (plugin, SDK,
routes, schema, billing page, env vars). No other payment provider besides
Cashfree is introduced.

---

## ADR-008: Upgrade Next.js 16, better-auth 1.7, Zod 4

Status: Accepted (user decision D1)
Date: 2026-10-27

Decision: Upgrade to latest Next.js 16.x, better-auth 1.7.x and Zod 4.x.
React to latest 19.x; drizzle-orm to ^0.45.2 (better-auth peer requirement).
All other dependencies keep their current major (TypeScript 5.x, ESLint 9,
Biome 1.9, …).

Reason: User requested latest framework versions; Next 15.3.2 was also exposed
to the late-2025 React Server Components RCE advisory.

Alternatives: Stay on Next 15.3.x with security patches (rejected by user).

---

## ADR-009: bun as package manager, Node as runtime

Status: Accepted
Date: 2026-10-27

Decision: Keep bun (`bun.lock`, scripts, Dockerfile). Node ≥ 20.9 runs Next.js
and the workers in production.

---

## ADR-010: Tracking file locations

Status: Accepted
Date: 2026-10-27

Decision: `diagrams/approved-architecture.txt` (approved target),
`diagrams/implementation-progress.md`, `diagrams/decisions.md` are canonical.
`docs/implementation-progress.md` and `docs/decisions.md` are pointers.
`docs/architecture.md` describes what is actually built.

Reason: Avoid two drifting copies.

---

## ADR-011: Identifiers and order numbers

Status: Accepted
Date: 2026-10-27

Decision: Text primary keys generated with cuid2. Human-facing order numbers
from a Postgres sequence: `GIL-<n>` (parent) and `GIL-<n>-<A|B|…>` (merchant
suborder).

---

## ADR-012: Money as integer paise

Status: Accepted
Date: 2026-10-27

Decision: Store money as integer paise in `bigint` columns (`mode: "number"`,
bounded by `Number.MAX_SAFE_INTEGER` at boundaries), with a `Money` value
object for arithmetic. APIs return integer paise; conversion to rupees only in
provider adapters and display formatting. No floating point in finance.

---

## ADR-013: Generated, version-controlled migrations

Status: Accepted
Date: 2026-10-27

Decision: `drizzle-kit generate` + `drizzle-kit migrate`, SQL committed in
`drizzle/`. Deployment runs a one-shot migrate service. `drizzle-kit push`
is never used against shared or production databases.

---

## ADR-014: Image storage via UploadThing behind a port

Status: Accepted
Date: 2026-10-27

Decision: Reuse the existing UploadThing integration for MVP product images
behind an `ImageStorage` port in the catalog module. Only URLs/keys are stored
in PostgreSQL.

---

## ADR-015: Structured logging and request correlation

Status: Accepted
Date: 2026-10-27

Decision: pino JSON logs; `x-request-id` resolved in `src/proxy.ts`
(Next 16 replacement for middleware) and propagated to outbox events and jobs.
Sentry only when `SENTRY_DSN` is configured.

---

## ADR-016: Worker build and deployment

Status: Accepted
Date: 2026-10-27

Decision: `bun build --target=node` bundles each `src/workers/*.ts` entry to
`dist/workers/*.js`, run with Node from the same image as the web app.
Compose services for the dispatcher and workers are added in the phase that
gives them real work (5, 6, 7). Shared domain/application code must not import
`server-only`.

---

## ADR-017: Merchant settlement and payouts

Status: Deferred
Date: 2026-10-27

Decision: Settlement rules, risk windows and payouts are decided after MVP
validation and merchant interviews. MVP records payables and remittances only;
no withdrawals or automatic payouts.

---

## ADR-018: Pricing formula and commissions

Status: Deferred
Date: 2026-10-27

Decision: Shipping-inclusive pricing formula and commission percentages are
decided after seller interviews. MVP stores seller base price, selling price,
courier estimate, actual courier charge and fees as snapshots; per-merchant
fee settings stay configurable; no invented percentages. Production checkout
requires a validated pricing configuration.

---

## ADR-019: Merchant penalty policy

Status: Deferred
Date: 2026-10-27

Decision: Acknowledgment/dispatch deadlines and alerts are built; financial
penalties wait for the merchant contract.

---

## ADR-020: S3-compatible storage adapter

Status: Deferred
Date: 2026-10-27

Decision: Add an S3-compatible `ImageStorage` adapter before production
if UploadThing is not retained.

---

## ADR-021: Per-merchant Shiprocket accounts

Status: Deferred
Date: 2026-10-27

Decision: Keep the shipping adapter capable of per-merchant account
configuration; implement only the platform account for MVP.

---

## ADR-022: API error contract and `{ data }` envelope

Status: Accepted
Date: 2026-10-27

Decision: Every `/api/v1` handler wraps `apiRoute()` (`src/platform/http.ts`).
Success is `{ data }` (200, 201 on create). Failure is
`{ error: { code, message, details? }, requestId }` with a stable snake_case
`code`; `details` carries field errors (`validation_failed`) or the locked
fields (`field_locked`). Unexpected errors are logged with the request id
and returned as `500 internal_error` without their message. All responses
are `Cache-Control: no-store`. Errors are `AppError` subclasses in
`src/platform/errors.ts`, which has no IO so the domain layer can throw them.

Consequence: clients branch on `code`, never on `message` text. The
contract is documented in `docs/api-contracts.md`.

---

## ADR-023: One owned merchant per user; membership decides the current shop

Status: Accepted
Date: 2026-10-27

Decision: In the MVP a user owns at most one merchant, enforced by the
partial unique index `merchant_members_one_owned_per_user` (WHERE
`role = 'owner'`), so concurrent onboarding cannot create two. Staff
memberships may be many. The current merchant is resolved from membership —
owner membership first, then the oldest — and never from a request
parameter. A shop switcher arrives with staff invitations.

Consequence: merchant endpoints take no merchant id; ids of another shop's
resources return 404.

---

## ADR-024: Field locking after approval

Status: Accepted
Date: 2026-10-27

Decision: DRAFT and REJECTED shops can edit everything; SUBMITTED shops
nothing (`409 under_review`); APPROVED and SUSPENDED shops cannot change
`storeName`, `slug`, `gstin`, `pan` or `fssaiLicense` (`409 field_locked`).
Changing them needs Gillu admin help (no admin edit screen yet). Sending
an unchanged locked value is allowed.

Consequence: customer-facing identity (name, URL) and the identifiers an
admin approved cannot drift after approval.

---

## ADR-025: Compliance identifiers optional and unverified

Status: Accepted
Date: 2026-10-27

Decision: GSTIN, PAN, FSSAI licence and compliance notes are optional,
stored as declared (uppercased) and shown as "Unverified" while
`merchants.compliance_verified_at` is null. Nothing sets it until Gillu
confirms which registrations each merchant type needs (open input).

Consequence: approval does not imply verified compliance; later phases must
not treat these fields as validated.

---

## ADR-026: Gillu UI port keeps the source CSS, scoped

Status: Accepted
Date: 2026-10-27

Decision: The Gillu landing page and merchant desk (`/opt/NH/gillu`) are
ported to React/TypeScript components that keep the source class names and
CSS. The CSS lives in `src/css/gillu-site.css` and `src/css/gillu-desk.css`
wrapped in `@scope (.gillu-site)` / `@scope (.gillu-desk)`, with port
additions as further `@scope` blocks; fonts load with `next/font/local`.
Demo-only behaviour (sample data, demo banners, local storage) is dropped.
The landing page is the `(site)` route group at `/`, the desk is
`/merchant/*`, and remaining Relivator pages move to the `(starter)` route
group, keeping Tailwind/shadcn.

Consequence: the two designs cannot leak into each other or into starter
pages, and visual parity can be checked against the source by screenshot.
Tailwind's preflight still applies inside the scopes; where it changed the
source look (image heights) a scoped rule restores it. A unit test fails
if a ported rule escapes its scope.

---

## ADR-027: Variants own price, MRP, SKU, pack size and stock

Status: Accepted
Date: 2026-10-27

Decision: A product is name, category, description, images and status.
Everything sold and shipped belongs to a variant: price and declared MRP in
integer paise (price ≤ MRP when MRP is set), SKU unique per shop, packed
weight and dimensions (for courier rates), active flag, and one `inventory`
row. A new product has one unlabelled variant; with more than one, every
variant needs a label. Variants are deactivated, never deleted.

Consequence: Phase 5 order lines reference variants; a product with one
size and one with many use the same code paths. `product_variants` carries
a denormalised `merchant_id` so SKU uniqueness is a plain constraint.

---

## ADR-028: Direct publish for approved shops, with admin hold

Status: Accepted
Date: 2026-10-27

Decision: Owners and staff of an APPROVED shop publish products directly
(no per-product review; PENDING_APPROVAL stays reserved). Publishing
re-reads the shop status and requires an active category, an active priced
variant and an image (`409 not_publishable` with `details.missing`).
Transitions are guarded UPDATEs: concurrent actions yield one winner and
`409 invalid_transition`. Admins moderate after the fact: a hold unpublishes
a published product with a reason (5–500 characters) shown to the merchant
and blocks republishing (`409 admin_hold`) until released; release leaves
it UNPUBLISHED. ARCHIVED is final.

Consequence: shops go live without waiting on Gillu, and Gillu can still
take a product down with an auditable reason (`admin_hold_by`,
`admin_hold_at`). The storefront must filter on hold, shop status and
category as `listPurchasableProducts` does.

---

## ADR-029: Image storage driver: local for development, UploadThing for production

Status: Accepted
Date: 2026-10-27
Refines: ADR-014

Decision: `IMAGE_STORAGE_DRIVER` selects the `ImageStorage` adapter:
`uploadthing` (default; server-side `UTApi.uploadFiles`, needs
`UPLOADTHING_TOKEN`) or `local` (files under `IMAGE_STORAGE_LOCAL_DIR`,
served by `GET /api/v1/images/<key>` with `nosniff` and an immutable
one-year cache). `local` is refused in production unless
`IMAGE_STORAGE_ALLOW_LOCAL_IN_PRODUCTION` is exactly `true`. Without a
usable driver, uploads answer `503 image_storage_unavailable` — never a
fake success. Uploads are accepted only as JPEG, PNG or WebP detected from
their bytes, at most 4 MB and 8 per product; dimensions are read with
`image-size`. The file is stored before its row is inserted and removed
again if the insert fails.

Consequence: E2E and local development need no third-party account. The
UploadThing adapter is code complete but unverified against the service
until a token exists (NEEDS_INPUT). A self-hosted deployment that opts into
`local` must mount a persistent volume.

---

## ADR-030: Stock changes only through guarded adjustments with a movement log

Status: Accepted
Date: 2026-10-27

Decision: Stock is set when a variant is created (movement INITIAL) and
afterwards changes only through adjustments with a reason (RESTOCK,
DAMAGED, CORRECTION, OTHER): `UPDATE inventory SET available = available +
$d WHERE variant_id = $v AND available + $d >= 0` plus an
`inventory_movements` row (delta, available after, actor, note) in one
transaction. Zero rows updated → `409 insufficient_stock`. `reserved`
exists for Phase 5 and is untouched.

Consequence: stock never goes negative, also under concurrent adjustments
(integration test with 20 concurrent decrements), and every change has an
audit trail. Phase 5 reservations use the same guarded-update pattern.

## ADR-031: A shop's story is complete before its products can publish

Status: Accepted
Date: 2026-10-28

Decision: A shop's story is complete when it has the story text (150 to 3000
characters), a village or town, a state from the list and at least one photo
(`isShopStoryComplete`). A product publishes only when its shop's story is
complete (publish blocker `shop_story`). Once the shop has a product on sale,
its story stays complete: clearing the text or place, or deleting the last
photo, is refused (`409 story_required`, `409 last_story_image`). A PUBLISHED
product cannot clear its made-by, made-how, origin or composition fields
(`409 story_required`); it must be unpublished first.

Consequence: every shop page a shopper can open has a story, and every product
has its origin and maker on record. The cost is that a maker must write a
story and add a photo before any product goes live, and that a selling shop
cannot quietly remove its story.

## ADR-032: Server-side guest cart with a hashed cookie and a lazy merge

Status: Accepted
Date: 2026-10-28

Decision: The cart lives on the server. A guest's cart is keyed by a random
32-byte token in the `gillu_cart` cookie (httpOnly, SameSite Lax, 30 days,
Secure in production); the database stores only its SHA-256 hash in
`carts.guest_token_hash`. A signed-in shopper's cart is keyed by `user_id`.
Sign-in does not merge at once: the first cart request that carries both a
session and the guest cookie merges the guest cart into the user's cart in one
transaction. Quantities sum and cap at 10 per line; lines beyond 30 are
dropped and reported as `mergeDropped`. The cookie is then cleared. Each line
keeps the price the shopper last saw (`unit_price_paise_seen`), so a price
change shows before checkout, and checkout entry re-checks stock and status
from the server; the checkout page reads the same cart view.

Consequence: a cart survives reloads, and the client can never set a price or
stock; the server returns the status of every line. Carts do not follow a shopper to
another browser unless they sign in there. Every write locks the cart row, so
concurrent adds of one variant end with one line (integration test).

## ADR-033: Storefront URLs live under the shop

Status: Accepted
Date: 2026-10-28

Decision: Product pages are `/shops/[shop]/[product]` and shop pages are
`/shops/[shop]`, with the matching API under `/api/v1/shops/[shop]/...`. This
replaces the `/shop/[merchantSlug]/[productSlug]` default in the Phase 4
brief. Product slugs are unique per shop (`products_merchant_slug_unique`), so the
pair of slugs identifies a product.

Consequence: a product's URL shows who made it, and shop links need no lookup
table. A product that is not purchasable is a 404 at its URL, and an
unpublished product has no page. The cost is a longer URL.

## ADR-034: Seen-shops cookie decides the story layout

Status: Accepted
Date: 2026-10-28

Decision: A cookie `gillu_seen_shops` (Max-Age one year, SameSite Lax) lists
the slugs of up to 50 shops the shopper has visited, newest last. On a shop
page, a returning visitor sees a compact strip (store name, place, "Read their
story") and the full story is rendered only when they open it; a first visit
shows the full story. The cookie is written by the client after the page
renders. Server code reads it with `cookies()`; only slug-shaped entries are
kept.

Consequence: returning visitors reach the products quickly, and nothing about
a shopper is stored on the server. The cost is that the list is per browser,
and clearing cookies shows the full story again.
