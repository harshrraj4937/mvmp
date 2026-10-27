# API Contracts

Status: Phase 2 — merchant and admin-merchant endpoints implemented and
verified (2026-10-27, branch `gillu/phase-2`).

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
| 400 | `validation_failed` | Body not JSON, or schema errors (`details`: field → messages) |
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

## Other

| Method & path | Success |
|---|---|
| `GET /api/health` | 200 `{ status: "ok", checks: { database: "ok" } }`, 503 when the database is unreachable (Phase 1) |
| `/api/auth/*` | better-auth (not part of this contract) |
