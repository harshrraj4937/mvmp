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
