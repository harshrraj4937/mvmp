# API Contracts

Status: Phase 3 — merchant, catalog and admin endpoints implemented and
verified (2026-10-27, branch `gillu/phase-3`).

Governed by: [design](superpowers/specs/2026-10-27-gillu-marketplace-design.md) §5.2, requirements §22. ADR-022.

## Conventions

- Base path `/api/v1`. JSON in, JSON out. Every response has
  `Cache-Control: no-store`.
- Success: `{ "data": … }` with 200 (201 on create).
- Error:

  ```json
  {
    "error": { "code": "validation_failed", "message": "Some fields are not valid.", "details": { "contactPhone": ["Enter a 10-digit Indian mobile number."] } },
    "requestId": "…"
  }
  ```

  `requestId` matches the `x-request-id` response header (set by
  `src/proxy.ts` / nginx). `details` appears only where listed below.
- Unexpected errors are logged with the request id and returned as
  `500 internal_error` "Something went wrong." — the cause is never sent.
- Handlers wrap `apiRoute()` from `src/platform/http.ts`; errors are
  `AppError` subclasses in `src/platform/errors.ts`.

| Status | Code | When |
|---|---|---|
| 400 | `validation_failed` | Body not JSON, bad query parameters, or schema errors (`details`: field → messages; nested fields also appear under their dotted path, e.g. `variant.price`) |
| 401 | `unauthorized` | No session |
| 403 | `forbidden` | Signed in but not allowed (not an admin; no shop; staff editing the profile) |
| 404 | `not_found` | Unknown id, or an id belonging to another merchant |
| 409 | see each endpoint | State conflict |
| 500 | `internal_error` | Anything unexpected |

Authentication is the better-auth session cookie. Merchant endpoints derive
the shop from the caller's membership; no endpoint takes a merchant id from
a merchant.

## Merchant

| Method & path | Body | Success | Errors |
|---|---|---|---|
| `POST /merchant/onboarding` | onboarding (below) | 201 profile | 400, 401, 409 `slug_taken`, 409 `already_merchant_owner` |
| `GET /merchant/profile` | — | 200 profile | 401, 403 |
| `PATCH /merchant/profile` | any non-empty subset of profile fields | 200 profile | 400, 401, 403 (staff), 409 `under_review`, 409 `field_locked` (`details.fields`), 409 `slug_taken`, 409 `stale_profile` |
| `POST /merchant/profile/submit` | — | 200 profile (`SUBMITTED`) | 401, 403, 409 `invalid_transition` |
| `GET /merchant/pickup-locations` | — | 200 list, primary first | 401, 403 |
| `POST /merchant/pickup-locations` | pickup location + optional `isPrimary` | 201 location | 400, 401, 403, 409 `primary_changed` |
| `PATCH /merchant/pickup-locations/{id}` | non-empty subset of pickup fields + `isPrimary` | 200 location | 400, 401, 403, 404, 409 `primary_required`, 409 `primary_changed` |

Onboarding body:

```json
{
  "storeName": "Lakshmi Silks",
  "slug": "lakshmi-silks",
  "description": "optional",
  "logoUrl": "https://… (optional)",
  "contactName": "Asha Rao",
  "contactEmail": "asha@example.in",
  "contactPhone": "+91 98765 43210",
  "businessAddress": { "line1": "…", "line2": "optional", "city": "Bengaluru", "state": "Karnataka", "postalCode": "560 001" },
  "returnAddress": { "…same shape…" },
  "gstin": "optional", "pan": "optional", "fssaiLicense": "optional", "complianceNotes": "optional",
  "pickup": { "label": "Warehouse (default Primary)", "contactName": "…", "phone": "…", "address": { "…" } }
}
```

Profile response fields: `id`, `storeName`, `slug`, `description`,
`logoUrl`, `contactName`, `contactEmail`, `contactPhone` (`+91…`),
`businessAddress`, `returnAddress`, `gstin`, `pan`, `fssaiLicense`,
`complianceNotes`, `complianceVerified`, `status`, `rejectionReason`,
`submittedAt`, `reviewedAt`.

Pickup location fields: `id`, `label`, `contactName`, `phone`, `line1`,
`line2`, `city`, `state`, `postalCode`, `isPrimary`.

## Catalog (merchant)

All require a signed-in member of an **APPROVED** shop
(`authorizeApprovedMerchant`): 401 signed out; 403 "You do not have a shop
yet."; 403 "Your shop must be approved to manage products." (also after a
suspension, from the next request). Product, variant and image ids of
another shop are 404. Money in requests is rupees as a string or number
("₹1,299.50", "1,00,000", 399); responses carry integer paise.

| Method & path | Body | Success | Errors |
|---|---|---|---|
| `GET /merchant/products?q=&status=` | — | 200 product summaries, newest change first; archived only with `status=ARCHIVED`; `q` matches name or SKU | 400 unknown status |
| `POST /merchant/products` | product create (below) | 201 product detail (`DRAFT`) | 400, 409 `sku_taken` (`details.sku`) |
| `GET /merchant/products/{id}` | — | 200 product detail | 404 |
| `PATCH /merchant/products/{id}` | non-empty subset of `name`, `categoryId`, `description` (blank clears), `slug` | 200 product detail | 400 (incl. hidden category), 404, 409 `archived`, 409 `slug_locked` (not DRAFT), 409 `slug_taken` |
| `POST /merchant/products/{id}/publish` | — | 200 detail (`PUBLISHED`) | 403 shop not approved (re-read), 404, 409 `admin_hold`, 409 `not_publishable` (`details.missing`: `category`, `variant`, `image`), 409 `invalid_transition` |
| `POST /merchant/products/{id}/unpublish` | — | 200 detail (`UNPUBLISHED`) | 404, 409 `invalid_transition` |
| `POST /merchant/products/{id}/archive` | — | 200 detail (`ARCHIVED`, final) | 404, 409 `invalid_transition` |
| `POST /merchant/products/{id}/variants` | variant fields + `label` (required) + `initialStock` | 201 product detail | 400, 404, 409 `archived`, 409 `label_required` (an existing variant has no label), 409 `sku_taken` |
| `PATCH /merchant/products/{id}/variants/{variantId}` | non-empty subset of variant fields, `label`, `isActive`; `mrp: ""` clears MRP | 200 variant | 400 (`mrp`: "Price cannot be higher than the declared MRP."), 404, 409 `archived`, 409 `last_variant`, 409 `label_required`, 409 `sku_taken` |
| `POST /merchant/products/{id}/images` | multipart: `file` (JPEG, PNG or WebP), optional `alt` | 201 image | 400 `validation_failed` (not multipart, no file), 400 `invalid_image`, 400 `image_too_large` (> 4 MB), 404, 409 `archived`, 409 `image_limit` (8), 503 `image_storage_unavailable` |
| `PATCH /merchant/products/{id}/images/{imageId}` | non-empty subset of `alt` (1–200), `sortOrder` (0–7) | 200 image | 400, 404, 409 `archived` |
| `DELETE /merchant/products/{id}/images/{imageId}` | — | 200 `{ data: null }` | 404, 503 `image_storage_unavailable` |
| `POST /merchant/variants/{variantId}/stock-adjustments` | `{ delta, reason, note? }` — delta a non-zero whole number up to ±100000; reason RESTOCK, DAMAGED, CORRECTION or OTHER | 200 variant | 400, 404, 409 `archived`, 409 `insufficient_stock` (would go below zero; nothing changes) |
| `GET /merchant/variants/{variantId}/stock-movements` | — | 200 latest 20 movements, newest first (`delta`, `availableAfter`, `reason`, `note`, `actorName`, `createdAt`) | 404 |

Variant ids are resolved within the caller's shop; the product id in a
variant or image path is not used for ownership.

Product create body:

```json
{
  "name": "Roasted cashews",
  "categoryId": "cat_snacks_and_sweets",
  "description": "optional",
  "initialStock": 12,
  "variant": {
    "price": "1,299", "mrp": "1499 (optional)", "sku": "kk-kaju-500",
    "weightGrams": 520, "lengthMm": 220, "widthMm": 160, "heightMm": 60
  }
}
```

Product summary fields: `id`, `name`, `slug`, `status`, `categoryName`,
`coverImageUrl`, `priceFromPaise` (lowest active variant), `totalAvailable`
(active variants), `lowStock` (an active variant has ≤ 5), `adminHoldReason`,
`merchantId`, `storeName`. Detail adds `categoryId`, `description`,
`images` (`id`, `url`, `alt`, `width`, `height`, `sortOrder`), `variants`
(`id`, `label`, `sku`, `pricePaise`, `declaredMrpPaise`, `weightGrams`,
`lengthMm`, `widthMm`, `heightMm`, `isActive`, `available`, `reserved`) and
`publishBlockers`.

## Catalog (public)

| Method & path | Success |
|---|---|
| `GET /categories` | 200 active categories (`id`, `name`, `slug`, `sortOrder`, `isActive`) in sort order; no session needed |
| `GET /images/{key}` | 200 image bytes stored by the `local` driver, with its content type, `X-Content-Type-Options: nosniff` and `Cache-Control: public, max-age=31536000, immutable`; 404 for unknown keys, keys outside the image directory, or another driver |

## Admin

All require an admin session: 401 signed out, 403 otherwise.

| Method & path | Body | Success | Errors |
|---|---|---|---|
| `GET /admin/merchants?status=` | — | 200 list (`id`, `storeName`, `slug`, `status`, `ownerEmail`, `submittedAt`, `createdAt`), oldest submission first | 400 unknown status |
| `GET /admin/merchants/{id}` | — | 200 detail (profile + `ownerEmail`, `pickupLocations`, `reviewedBy`) | 404 |
| `POST /admin/merchants/{id}/approve` | — | 200 detail (`APPROVED`) | 404, 409 `invalid_transition` (not SUBMITTED) |
| `POST /admin/merchants/{id}/reject` | `{ "reason": "5–500 chars" }` | 200 detail (`REJECTED`) | 400, 404, 409 `invalid_transition` |
| `POST /admin/merchants/{id}/suspend` | — | 200 detail (`SUSPENDED`) | 404, 409 `invalid_transition` (not APPROVED) |
| `POST /admin/merchants/{id}/reinstate` | — | 200 detail (`APPROVED`) | 404, 409 `invalid_transition` (not SUSPENDED) |
| `GET /admin/categories` | — | 200 every category, hidden included | — |
| `POST /admin/categories` | `{ name, sortOrder? }` | 201 category (slug from the name) | 400, 409 `category_exists` (same name in any case) |
| `PATCH /admin/categories/{id}` | non-empty subset of `name`, `isActive`, `sortOrder` | 200 category (slug unchanged on rename) | 400, 404, 409 `category_exists` |
| `GET /admin/products?status=` | — | 200 product summaries of every shop | 400 unknown status |
| `POST /admin/products/{id}/unpublish` | `{ "reason": "5–500 chars" }` | 200 summary (`UNPUBLISHED`, `adminHoldReason` set) — a hold | 400, 404, 409 `invalid_transition` (not PUBLISHED) |
| `POST /admin/products/{id}/release` | — | 200 summary (hold cleared, still `UNPUBLISHED`) | 404, 409 `no_hold` |

## Other

| Method & path | Success |
|---|---|
| `GET /api/health` | 200 `{ status: "ok", checks: { database: "ok" } }`, 503 when the database is unreachable (Phase 1) |
| `/api/auth/*` | better-auth (not part of this contract) |
