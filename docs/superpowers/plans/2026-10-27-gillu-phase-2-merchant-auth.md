# Gillu Phase 2 — Merchant Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in user (email/password or Google) registers a shop, submits it for review, an admin approves it, and the merchant then reaches an approved merchant dashboard. Merchants can edit their profile and manage pickup addresses, and can see only their own merchant's data.

**Architecture:** Add a new `src/modules/merchants` module:
- `domain/`: status machine, validation and field-locking rules, all pure.
- `application/`: services that take `db` plus an authorized actor.
- `index.ts`: server-only. It turns the session into an actor and exposes the page and API guards.

Thin `/api/v1/**` route handlers use one shared error contract from `src/platform/http.ts`. Pages and data functions each authorize themselves; layouts only handle UX (lesson from Phase 1's final review).

**Tech Stack:**
- Next.js 16.4 App Router: `RouteContext<'/path/[id]'>` and `params` as a Promise.
- better-auth 1.7.14: Google via `socialProviders.google` with `prompt: "select_account"`.
- drizzle-orm 0.45 and drizzle-kit 0.31 (generated migrations), Zod 4.
- Vitest with Testcontainers, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-27-gillu-marketplace-design.md`. Requirements: `diagrams/implementation-prompt.txt` §7 (roles), §8 (merchant registration), §19 (merchant pages), §21 (tables), §22 (API), §26 Phase 2 and §29 (completion rule).

## Global Constraints

- Phase 2 deliverable (§26): "Merchant can register and access an approved dashboard."
- Registration states, exactly: `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `SUSPENDED` (§8).
- Onboarding fields (§8): store name, store slug, description, owner/contact name, email, phone, business address, pickup address, return address, pickup postal code, store logo, and business identification fields where applicable.
- Compliance (§8): "Do not assume every merchant requires the same statutory registration fields; flag unverified compliance requirements for confirmation." GSTIN, PAN and FSSAI are optional. They are shown as **unverified** (`compliance_verified_at` is null) in this phase.
- Roles (§7, ADR-006):
  - CUSTOMER = any signed-in user.
  - MERCHANT = a `merchant_members` row (`owner` | `staff`).
  - ADMIN = `user.role` containing `admin`, granted only by `admin:grant`.
  - "Do not assume every merchant account is associated with exactly one user forever."
- Isolation (§7, spec §5.3): every merchant-scoped query takes `merchantId` from the authorized membership, **never** from the request body or URL. Tests must assert this.
- API (§22), under `/api/v1`: `POST /merchant/onboarding`, `GET|PATCH /merchant/profile`, `GET /admin/merchants`, `POST /admin/merchants/:id/approve`, `POST /admin/merchants/:id/reject`. Extra routes below are additions, not replacements.
- Error shape (spec §5.2): `{ "error": { "code", "message", "details"? }, "requestId" }`. Success shape: `{ "data": … }`.
- Merchant pages (§19) in this phase: `/merchant/onboarding`, `/merchant/dashboard`, `/merchant/profile`, `/merchant/settings/shipping`.
- IDs: cuid2 text primary keys (`@paralleldrive/cuid2`, `createId()`). Timestamps: `created_at` and `updated_at`.
- Migrations are generated (`bun run db:generate`) and committed. Never use `db:push`. Never touch the `relivator_postgres_data` volume.
- "Never claim a provider integration is verified solely because a mock test passed." Google sign-in stays **manual verification pending credentials** until a human signs in with real Google credentials.
- No secrets in client bundles. Only `NEXT_PUBLIC_*` values may reach client components.
- Work on branch `gillu/phase-2`, created from `gillu/phase-0-1` (not merged yet). One commit per task. Never push.
- Commit attribution line: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Commands: `export PATH=$HOME/.bun/bin:$PATH`. Gate commands are `bun run typecheck`, `bun run lint`, `bun run knip`, `bun run test`, `bun run test:e2e` (includes the production build).
- Import `test` and `expect` in E2E specs from `tests/e2e/helpers.ts` (per-test client IP). Never use `networkidle`.

## Review Focus

1. **Open redirect through `?next=`.** Inputs like `//evil.com`, `/\evil.com`, `https://evil.com`, `javascript:` or an encoded `%2F%2Fevil.com` must land on the default page, never off-site. Pinned in Task 2 (`safeNextPath` unit tests).
2. **Onboarding submitted twice** (double click or two tabs). Exactly one merchant must exist; the second call gets `409 already_merchant_owner` and leaves nothing half-written. Pinned in Task 4 (concurrent register integration test, plus a partial unique index).
3. **Two admins act on the same submission at once** (approve vs reject). Exactly one wins; the other gets `409 invalid_transition`. Pinned in Task 5 (concurrent review integration test).
4. **Id tampering.** A merchant sending another merchant's pickup-location id or merchant id in the URL or body gets `404`, and the other merchant's row is unchanged. Pinned in Task 6 (integration) and Task 7 (E2E over HTTP).
5. **Messy Indian input.** Phone as `+91 98765 43210`, `098765-43210` or `9876543210`; lowercase GSTIN or PAN; postal code with spaces such as `560 001`; slug in mixed case. These are normalized, or rejected with a field-specific message, never stored as given. Pinned in Task 3 (validation unit tests).

Also pinned: a merchant **suspended while signed in** loses dashboard access on the next request (Task 8 E2E).

---

## File Structure

```
src/platform/http.ts                       AppError hierarchy, apiRoute(), parseJson(), ok()
src/lib/auth-social.ts                     buildSocialProviders(env), configuredSocialProviders()
src/lib/safe-next-path.ts                  safeNextPath(raw)
src/modules/identity/index.ts              + getSessionUser, authorizeSession, authorizeAdmin, AdminActor; requireSession(nextPath?)
src/db/schema/merchants/tables.ts          merchants, merchant_members, merchant_pickup_locations + enums
src/db/schema/merchants/relations.ts       drizzle relations
src/modules/merchants/domain/status.ts     MerchantStatus, canTransition, assertTransition, canSell
src/modules/merchants/domain/profile-rules.ts  lockedFieldsFor(status), canManageProfile(role)
src/modules/merchants/domain/slug.ts       suggestSlug, RESERVED_SLUGS
src/modules/merchants/presentation/schemas.ts  Zod DTOs: onboarding, profile patch, pickup, review
src/modules/merchants/application/register.ts      registerMerchant
src/modules/merchants/application/membership.ts    findMerchantForUser, MerchantContext
src/modules/merchants/application/profile.ts       getMerchantProfile, updateMerchantProfile, submitMerchant
src/modules/merchants/application/review.ts        listMerchants, getMerchantForAdmin, approve/reject/suspend/reinstate
src/modules/merchants/application/pickup.ts        list/add/updatePickupLocation
src/modules/merchants/index.ts             server-only: getCurrentMerchant, requireMerchant, requireApprovedMerchant, authorizeMerchant + re-exports
src/app/api/v1/merchant/**                 route handlers
src/app/api/v1/admin/merchants/**          route handlers
src/app/merchant/**                        pages (onboarding, profile, settings/shipping, dashboard)
src/app/admin/merchants/**                 admin pages (list, detail)
```

---

### Task 1: Branch and API error contract

**Files:**
- Create: `src/platform/http.ts`, `tests/unit/platform/http.test.ts`

**Interfaces:**
- Produces:
  - `class AppError extends Error { readonly code: string; readonly status: number; readonly details?: unknown }`.
  - Subclasses with fixed status and default code: `ValidationError` (400, `validation_failed`), `UnauthorizedError` (401, `unauthorized`, message "Sign in to continue."), `ForbiddenError` (403, `forbidden`), `NotFoundError` (404, `not_found`), `ConflictError` (409, code given by caller).
  - Every constructor is `(message?: string, details?: unknown)`, except `ConflictError(code: string, message: string, details?: unknown)`.
  - `errorResponse(error: unknown, requestId: string): Response`.
  - `apiRoute<C>(handler: (request: Request, context: C, requestId: string) => Promise<Response>): (request: Request, context: C) => Promise<Response>`.
  - `parseJson<T>(request: Request, schema: z.ZodType<T>): Promise<T>`.
  - `ok(data: unknown, status = 200): Response`.

- [ ] **Step 1: Create the branch.** Run `git switch -c gillu/phase-2` from `gillu/phase-0-1`. Expected: `Switched to a new branch 'gillu/phase-2'`.

- [ ] **Step 2: Write the failing tests** in `tests/unit/platform/http.test.ts`. Stub env the same way `logger.test.ts` does, because `http.ts` logs through `logger`.

```ts
test("AppError subclasses map to the error shape with the request id", async () => {
  const res = errorResponse(new ConflictError("slug_taken", "That shop URL is taken."), "req-12345678");
  expect(res.status).toBe(409);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(await res.json()).toEqual({
    error: { code: "slug_taken", message: "That shop URL is taken." },
    requestId: "req-12345678",
  });
});

test("unknown errors become a generic 500 without leaking the message", async () => {
  const res = errorResponse(new Error("password=hunter2 at db"), "req-12345678");
  expect(res.status).toBe(500);
  const body = await res.json();
  expect(body.error).toEqual({ code: "internal_error", message: "Something went wrong." });
  expect(JSON.stringify(body)).not.toContain("hunter2");
});

test("parseJson rejects non-JSON and reports field errors", async () => {
  const schema = z.object({ name: z.string().min(2) });
  await expect(parseJson(new Request("http://x", { body: "nope", method: "POST" }), schema))
    .rejects.toMatchObject({ code: "validation_failed", status: 400 });
  await expect(parseJson(new Request("http://x", { body: JSON.stringify({ name: "a" }), method: "POST" }), schema))
    .rejects.toMatchObject({ details: { name: expect.any(Array) } });
});

test("apiRoute uses the proxy's request id and converts thrown AppErrors", async () => {
  const handler = apiRoute(async () => { throw new NotFoundError(); });
  const res = await handler(new Request("http://x", { headers: { "x-request-id": "abcdefgh1234" } }), {});
  expect(res.status).toBe(404);
  expect((await res.json()).requestId).toBe("abcdefgh1234");
});
```

- [ ] **Step 3: Run the tests.** Run `bunx vitest run --project unit tests/unit/platform/http.test.ts`. Expected: FAIL (`~/platform/http` cannot be resolved).

- [ ] **Step 4: Implement `src/platform/http.ts`.**
  - `details` for a `ValidationError` from Zod is `z.flattenError(error).fieldErrors`.
  - `errorResponse` logs non-`AppError` errors with `logger.error({ err: error, requestId }, "unhandled api error")`.
  - `apiRoute` reads `x-request-id` through `resolveRequestId`.
  - All responses set `Cache-Control: no-store`.

- [ ] **Step 5: Run the tests again.** Same command. Expected: PASS, 4/4.

- [ ] **Step 6: Commit.** Message: `feat(platform): API error contract and route helper`.

---

### Task 2: Google OAuth, safe `next` redirects, identity authorize helpers

**Files:**
- Create: `src/lib/auth-social.ts`, `src/lib/safe-next-path.ts`, `tests/unit/identity/auth-social.test.ts`, `tests/unit/identity/safe-next-path.test.ts`
- Modify:
  - `src/lib/auth.ts`: drop the inline provider block; use `buildSocialProviders(getServerEnv())`.
  - `src/modules/identity/index.ts`.
  - Sign-in and sign-up `page.tsx` and `page.client.tsx`.
- Test: `tests/e2e/auth.spec.ts` (add tests)

**Interfaces:**
- Consumes: `UnauthorizedError` and `ForbiddenError` (Task 1).
- Produces:
  - `type SocialProviderId = "github" | "google"`.
  - `buildSocialProviders(env: Pick<ServerEnv, "AUTH_GITHUB_ID" | "AUTH_GITHUB_SECRET" | "AUTH_GOOGLE_ID" | "AUTH_GOOGLE_SECRET">): Partial<Record<SocialProviderId, SocialProviderConfig>>`.
  - `configuredSocialProviders(): SocialProviderId[]`.
  - `safeNextPath(raw: null | string | undefined): null | string`.
  - Identity:
    - `getSessionUser(): Promise<SessionUser | null>`, wrapped in `cache()`.
    - `requireSession(nextPath?: string)`: redirects to `/auth/sign-in?next=<encoded>` when `nextPath` is given.
    - `type AdminActor = SessionUser & { readonly admin: true }`. `requireAdmin(): Promise<AdminActor>`.
    - `authorizeSession(): Promise<SessionUser>`: throws `UnauthorizedError`.
    - `authorizeAdmin(): Promise<AdminActor>`: throws `UnauthorizedError` or `ForbiddenError`.

- [ ] **Step 1: Write the failing unit tests.**

```ts
// safe-next-path.test.ts
test.each(["/merchant/onboarding", "/merchant/profile?tab=1", "/"])("keeps local path %s", (p) =>
  expect(safeNextPath(p)).toBe(p));
test.each([null, "", "//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)",
  "%2F%2Fevil.com", "/%2F/evil.com", "evil.com", " /merchant"])("rejects %s", (p) =>
  expect(safeNextPath(p)).toBeNull());

// auth-social.test.ts
test("configures Google only when both id and secret are set", () => {
  expect(buildSocialProviders({ AUTH_GOOGLE_ID: "id" })).toEqual({});
  expect(buildSocialProviders({ AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "s" }).google)
    .toMatchObject({ clientId: "id", clientSecret: "s", prompt: "select_account" });
});
test("maps the Google profile to first and last name", () => {
  const google = buildSocialProviders({ AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "s" }).google!;
  expect(google.mapProfileToUser({ family_name: "Rao", given_name: "Asha" }))
    .toEqual({ age: null, firstName: "Asha", lastName: "Rao" });
});
test("configures GitHub only when both id and secret are set", () => {
  expect(buildSocialProviders({ AUTH_GITHUB_ID: "id", AUTH_GITHUB_SECRET: "s" }).github)
    .toMatchObject({ clientId: "id" });
});
```

- [ ] **Step 2: Run the unit tests.** Run `bunx vitest run --project unit tests/unit/identity`. Expected: FAIL (modules missing).

- [ ] **Step 3: Implement `safeNextPath` and `buildSocialProviders`.**
  - `safeNextPath` decodes once with `decodeURIComponent` inside try/catch (decode failure returns null). It accepts only values that start with `/`, are not `//` or `/\`, contain no `\`, and have no leading or trailing whitespace. It returns the **original** raw string.
  - Move the GitHub and Google config into `auth-social.ts`. Google adds `prompt: "select_account"`.
  - `auth.ts` keeps `trustedProviders: Object.keys(socialProviders)`.
  - `configuredSocialProviders()` returns the keys built from `getServerEnv()`. This also resolves the deferred minor "social creds read process.env".

- [ ] **Step 4: Run the unit tests again.** Same command. Expected: PASS.

- [ ] **Step 5: Write the failing E2E tests** in `tests/e2e/auth.spec.ts`.
  - `social buttons appear only for configured providers`: on `/auth/sign-in`, Google and GitHub buttons have count 0. The E2E env has no credentials.
  - `sign-in returns to a safe next path`: sign up, sign out, then `page.goto("/auth/sign-in?next=%2Fdashboard%2Fprofile")`. After `signIn`, the URL is `/dashboard/profile`.
  - `sign-in ignores an off-site next path`: `?next=%2F%2Fevil.com`. After sign-in, the URL is `/dashboard/uploads`.

- [ ] **Step 6: Run the E2E tests.** Run `bun run test:e2e -- tests/e2e/auth.spec.ts`. Expected: the 3 new tests FAIL (buttons render; next is ignored).

- [ ] **Step 7: Wire up the pages and identity.**
  - Sign-in and sign-up server pages read `searchParams` (a Promise) and compute `next = safeNextPath(sp.next)`.
  - A signed-in visitor is redirected to `next ?? SYSTEM_CONFIG.redirectAfterSignIn`.
  - The pages pass `{ next, socialProviders: configuredSocialProviders() }` to the client.
  - The client renders a social button only if its id is listed, and hides the "or continue with" separator when none are.
  - After success, the client pushes `next ?? redirectAfter…`. Social calls pass `callbackURL: next ?? redirectAfter…`.
  - Links between the sign-in and sign-up pages carry `next` along.
  - Identity: add `getSessionUser`, the `requireSession(nextPath?)` redirect, `AdminActor`, `authorizeSession` and `authorizeAdmin`. `requireAdmin` returns `{ ...user, admin: true }`.

- [ ] **Step 8: Run the E2E tests again.** Same command. Expected: all auth tests PASS.

- [ ] **Step 9: Commit.** Message: `feat(identity): Google provider config, safe next redirects, API authorization`.

---

### Task 3: Merchants domain rules and input schemas

**Files:**
- Create: `src/modules/merchants/domain/{status,profile-rules,slug}.ts`, `src/modules/merchants/presentation/schemas.ts`
- Test: `tests/unit/merchants/{status,profile-rules,schemas}.test.ts`

**Interfaces:**
- Produces:
  - `MERCHANT_STATUSES = ["DRAFT","SUBMITTED","APPROVED","REJECTED","SUSPENDED"] as const` and `type MerchantStatus`.
  - `canTransition(from, to): boolean` and `assertTransition(from, to): void` (throws `ConflictError("invalid_transition", …)`).
  - `canSell(status): boolean` (APPROVED only; used by Phase 3).
  - `type MerchantRole = "owner" | "staff"` and `canManageProfile(role): boolean` (owner only).
  - `PROFILE_FIELDS` and `lockedFieldsFor(status): ReadonlySet<ProfileField>`.
  - `suggestSlug(name: string): string` and `RESERVED_SLUGS`.
  - Zod schemas with inferred types:
    - `postalAddressSchema` → `PostalAddress { line1; line2?; city; state; postalCode }`.
    - `onboardingSchema` → `OnboardingInput`.
    - `profilePatchSchema` → `ProfilePatch`.
    - `pickupLocationSchema` → `PickupLocationInput`, and `pickupLocationPatchSchema`.
    - `rejectSchema` → `{ reason }`.

The decided rules are below. The tests pin them.
- **Transitions:**
  - DRAFT → SUBMITTED
  - SUBMITTED → APPROVED | REJECTED
  - REJECTED → SUBMITTED
  - APPROVED → SUSPENDED
  - SUSPENDED → APPROVED
  - Everything else is invalid.
- **Locked fields:**
  - DRAFT and REJECTED: nothing is locked.
  - SUBMITTED: every field is locked (under review).
  - APPROVED and SUSPENDED: `storeName`, `slug`, `gstin`, `pan` and `fssaiLicense` are locked. Changing them would bypass review.
- **Normalization:**
  - Strings are trimmed.
  - Slug is lowercased. It must match `^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$`, must not contain `--`, and must not be in `RESERVED_SLUGS` = `admin, api, auth, gillu, merchant, merchants, new, settings, shop, shops`.
  - Phone: strip spaces, `-`, `(` and `)`. Then `^(?:\+91|91|0)?([6-9]\d{9})$` gives `+91XXXXXXXXXX`.
  - Postal code: strip spaces, then `^[1-9]\d{5}$`.
  - GSTIN and PAN are uppercased. GSTIN must match `^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$`, PAN `^[A-Z]{5}\d{4}[A-Z]$`, FSSAI `^\d{14}$`. All three are optional, and an empty string means absent.
- **Lengths:**
  - storeName 2–80, contactName 2–80, description ≤ 1000 (optional), complianceNotes ≤ 1000, reject reason 5–500.
  - Address line1 3–200, line2 ≤ 200, city 2–80, state 2–80.
  - `contactEmail` uses `z.email()`.
  - `logoUrl` is optional `z.url()` starting with `https://`.
- **Shapes:**
  - `onboardingSchema = { storeName, slug, description?, contactName, contactEmail, contactPhone, businessAddress, returnAddress, pickup: pickupLocationSchema, logoUrl?, gstin?, pan?, fssaiLicense?, complianceNotes? }`.
  - `pickupLocationSchema = { label (2–40, default "Primary"), contactName, phone, address: postalAddressSchema }`.
  - `profilePatchSchema` = `onboardingSchema.omit({ pickup }).partial()`, refined so that at least one key is present.

- [ ] **Step 1: Write the failing tests.** Key cases:

```ts
test.each([["DRAFT","SUBMITTED"],["SUBMITTED","APPROVED"],["SUBMITTED","REJECTED"],
  ["REJECTED","SUBMITTED"],["APPROVED","SUSPENDED"],["SUSPENDED","APPROVED"]])("%s → %s allowed", (f, t) =>
  expect(canTransition(f, t)).toBe(true));
test.each([["DRAFT","APPROVED"],["APPROVED","REJECTED"],["REJECTED","APPROVED"],["SUBMITTED","SUBMITTED"]])(
  "%s → %s refused", (f, t) => expect(() => assertTransition(f, t)).toThrow(/invalid_transition|cannot/i));
test("only APPROVED can sell", () => expect(MERCHANT_STATUSES.filter(canSell)).toEqual(["APPROVED"]));
test("approved merchants cannot change name, slug or compliance ids", () =>
  expect([...lockedFieldsFor("APPROVED")].sort()).toEqual(["fssaiLicense","gstin","pan","slug","storeName"]));
test("submitted merchants are fully locked", () => expect(lockedFieldsFor("SUBMITTED").size).toBe(PROFILE_FIELDS.length));
test("staff cannot manage the profile", () => { expect(canManageProfile("owner")).toBe(true); expect(canManageProfile("staff")).toBe(false); });
test("suggestSlug", () => expect(suggestSlug("  Lakshmi's Silk & Saree House!! ")).toBe("lakshmis-silk-saree-house"));

test.each(["+91 98765 43210", "098765-43210", "9876543210", "(91) 98765 43210"])("phone %s → +919876543210", (p) =>
  expect(onboardingSchema.shape.contactPhone.parse(p)).toBe("+919876543210"));
test.each(["12345", "5876543210", "+1 2025550123"])("phone %s rejected", (p) =>
  expect(onboardingSchema.shape.contactPhone.safeParse(p).success).toBe(false));
test("postal code with spaces is normalized; leading zero rejected", () => {
  expect(postalAddressSchema.shape.postalCode.parse("560 001")).toBe("560001");
  expect(postalAddressSchema.shape.postalCode.safeParse("060001").success).toBe(false);
});
test("GSTIN and PAN are uppercased; empty means absent", () => {
  const r = onboardingSchema.parse({ ...validOnboarding, gstin: "29abcde1234f1z5", pan: "abcde1234f", fssaiLicense: "" });
  expect([r.gstin, r.pan, r.fssaiLicense]).toEqual(["29ABCDE1234F1Z5", "ABCDE1234F", undefined]);
});
test.each(["ab", "Admin", "my--shop", "-shop", "shop name", "a".repeat(51)])("slug %s rejected", (s) =>
  expect(onboardingSchema.shape.slug.safeParse(s).success).toBe(false));
test("slug is lowercased", () => expect(onboardingSchema.shape.slug.parse("Lakshmi-Silks")).toBe("lakshmi-silks"));
```

Notes:
- `Admin` lowercases to the reserved word `admin`, so it is rejected.
- `validOnboarding` is a fixture in `tests/support/merchant-fixtures.ts`, exported as `validOnboarding(overrides?)`. Tasks 4–9 reuse it.

- [ ] **Step 2: Run the tests.** Run `bunx vitest run --project unit tests/unit/merchants`. Expected: FAIL (modules missing).

- [ ] **Step 3: Implement the domain and schema files.** No IO, and no `server-only` imports (ADR-016).

- [ ] **Step 4: Run the tests again.** Same command. Expected: PASS.

- [ ] **Step 5: Commit.** Message: `feat(merchants): status machine, profile rules and input validation`.

---

### Task 4: Merchant schema, migration, registration, membership

**Files:**
- Create: `src/db/schema/merchants/{tables,relations}.ts`, `src/modules/merchants/application/{register,membership}.ts`, the generated `drizzle/0002_*.sql`
- Modify: `src/db/schema/index.ts` (export merchants), `tests/integration/db/migrations.test.ts`
- Test: `tests/integration/merchants/register.test.ts`

**Interfaces:**
- Consumes: Task 3 types and `ConflictError`.
- Produces:
  - Tables: `merchantsTable`, `merchantMembersTable`, `merchantPickupLocationsTable`.
  - Enums: `merchantStatusEnum` (`merchant_status`) and `merchantMemberRoleEnum` (`merchant_member_role`).
  - `interface MerchantContext { merchantId: string; role: MerchantRole; slug: string; status: MerchantStatus; storeName: string; userId: string }`.
  - `registerMerchant(db: Database, user: { id: string }, input: OnboardingInput): Promise<MerchantContext>`.
  - `findMerchantForUser(db: Database, userId: string): Promise<MerchantContext | null>`.

**Schema (decided):**

`merchants`:

| Column | Definition |
|---|---|
| `id` | text PK |
| `store_name` | text not null |
| `slug` | text not null, **unique** |
| `description` | text |
| `logo_url` | text |
| `contact_name`, `contact_email`, `contact_phone` | text not null |
| `business_address`, `return_address` | `jsonb.$type<PostalAddress>()` not null |
| `gstin`, `pan`, `fssai_license`, `compliance_notes` | text |
| `compliance_verified_at` | timestamp |
| `status` | `merchant_status` not null, default `DRAFT` |
| `submitted_at`, `reviewed_at` | timestamp |
| `reviewed_by` | text, FK user, **on delete set null** |
| `rejection_reason` | text |
| `created_at`, `updated_at` | timestamp |

Index on `status`.

`merchant_members`:
- Columns: `id`; `merchant_id` (FK, cascade); `user_id` (FK user, cascade); `role` (`merchant_member_role` not null); `created_at`.
- Unique on (`merchant_id`, `user_id`). Index on `user_id`.
- **Partial unique index** `merchant_members_one_owned_per_user` on (`user_id`) `WHERE role = 'owner'`.

`merchant_pickup_locations`:
- Columns: `id`; `merchant_id` (FK, cascade); `label`; `contact_name`; `phone`; `line1`; `line2`; `city`; `state`; `postal_code` (all not null except `line2`); `is_primary` (bool not null default false); `provider_location_name` (text, nullable until Phase 7); `created_at`; `updated_at`.
- CHECK `postal_code ~ '^[1-9][0-9]{5}$'`.
- Partial unique index on (`merchant_id`) `WHERE is_primary`. Index on `merchant_id`.

- [ ] **Step 1: Write the failing integration tests** in `tests/integration/merchants/register.test.ts`. Seed users with `createId()`, the same way `grant-admin.test.ts` does.

```ts
test("registration creates a DRAFT merchant, owner membership and primary pickup location atomically", async () => {
  const ctx = await registerMerchant(db, { id: userId }, validOnboarding({ slug: uniqueSlug() }));
  expect(ctx).toMatchObject({ role: "owner", status: "DRAFT", userId });
  expect(await findMerchantForUser(db, userId)).toEqual(ctx);
  const pickups = await db.select().from(merchantPickupLocationsTable).where(eq(merchantPickupLocationsTable.merchantId, ctx.merchantId));
  expect(pickups).toHaveLength(1);
  expect(pickups[0]).toMatchObject({ isPrimary: true, postalCode: "560001" });
});

test("a taken slug is a 409 slug_taken and leaves nothing behind", async () => {
  const slug = uniqueSlug();
  await registerMerchant(db, { id: await seedUser() }, validOnboarding({ slug }));
  const other = await seedUser();
  await expect(registerMerchant(db, { id: other }, validOnboarding({ slug })))
    .rejects.toMatchObject({ code: "slug_taken", status: 409 });
  expect(await findMerchantForUser(db, other)).toBeNull();
});

test("double-submitted onboarding creates exactly one merchant", async () => {
  const user = await seedUser();
  const results = await Promise.allSettled([
    registerMerchant(db, { id: user }, validOnboarding({ slug: uniqueSlug() })),
    registerMerchant(db, { id: user }, validOnboarding({ slug: uniqueSlug() })),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { code: "already_merchant_owner" } });
  const owned = await db.select().from(merchantMembersTable).where(eq(merchantMembersTable.userId, user));
  expect(owned).toHaveLength(1);
});

test("a user with no membership has no merchant", async () =>
  expect(await findMerchantForUser(db, await seedUser())).toBeNull());

test("membership resolution prefers the owned merchant over staff memberships", async () => {
  // user is staff on merchant A (inserted directly), then owns merchant B → resolves to B
});
```

Also extend `migrations.test.ts`: the three new tables exist.

- [ ] **Step 2: Run the integration tests.** Run `bunx vitest run --project integration tests/integration/merchants`. Expected: FAIL (modules missing).

- [ ] **Step 3: Write the schema and generate the migration.**
  - Write the tables and relations, and export them from `src/db/schema/index.ts`.
  - Run `bun run db:generate`. Expected: a new `drizzle/0002_*.sql` containing only `CREATE TYPE`, `CREATE TABLE` and `CREATE INDEX`, plus the CHECK. **No `DROP`.** Read the SQL before continuing.
  - The global setup applies migrations, so the tests run against the generated SQL.

- [ ] **Step 4: Implement `registerMerchant` and `findMerchantForUser`.**
  - `registerMerchant` runs in one `db.transaction`: insert the merchant, then the owner membership, then the primary pickup location.
  - Map Postgres `23505` by constraint name:
    - `merchants_slug_unique` → `ConflictError("slug_taken", "That shop URL is already taken.")`.
    - `merchant_members_one_owned_per_user` → `ConflictError("already_merchant_owner", "You already have a shop.")`.
  - Check for an existing owned merchant first, so the common case gets a clean error. Rely on the index for the race.
  - `findMerchantForUser` joins members and merchants, ordered by `role = 'owner'` descending, then `created_at` ascending, limit 1.

- [ ] **Step 5: Run the integration tests again.** Same command. Expected: PASS. Then run `bun run test`. Expected: all pass.

- [ ] **Step 6: Commit.** Message: `feat(merchants): schema, migration, registration and membership lookup`.

---

### Task 5: Profile, submission and admin review services

**Files:**
- Create: `src/modules/merchants/application/{profile,review}.ts`
- Test: `tests/integration/merchants/{profile,review}.test.ts`

**Interfaces:**
- Consumes: `MerchantContext`, `AdminActor` (Task 2), domain rules (Task 3).
- Produces:
  - `interface MerchantProfile { id; storeName; slug; description: null|string; logoUrl: null|string; contactName; contactEmail; contactPhone; businessAddress: PostalAddress; returnAddress: PostalAddress; gstin: null|string; pan: null|string; fssaiLicense: null|string; complianceNotes: null|string; complianceVerified: boolean; status: MerchantStatus; rejectionReason: null|string; submittedAt: Date|null; reviewedAt: Date|null }`.
  - `getMerchantProfile(db, ctx: MerchantContext): Promise<MerchantProfile>`.
  - `updateMerchantProfile(db, ctx, patch: ProfilePatch): Promise<MerchantProfile>`.
  - `submitMerchant(db, ctx): Promise<MerchantProfile>`.
  - `interface MerchantListItem { id; storeName; slug; status; contactEmail; ownerEmail: string; submittedAt: Date|null; createdAt: Date }`.
  - `listMerchants(db, admin: AdminActor, filter: { status?: MerchantStatus }): Promise<MerchantListItem[]>`.
  - `getMerchantForAdmin(db, admin, merchantId): Promise<MerchantProfile & { ownerEmail: string; pickupLocations: PickupLocation[] }>`.
  - `approveMerchant(db, admin, merchantId)`, `rejectMerchant(db, admin, merchantId, reason)`, `suspendMerchant(db, admin, merchantId)`, `reinstateMerchant(db, admin, merchantId)`. Each returns `Promise<MerchantProfile>`.

**Rules:**
- **`updateMerchantProfile`:**
  - Staff role → `ForbiddenError("Only the shop owner can change the profile.")`.
  - A patch touching a locked field → `ConflictError("field_locked", …, { fields })`.
  - SUBMITTED → `ConflictError("under_review", "Your shop is under review and cannot be edited.")`.
  - A slug change hitting a duplicate → `slug_taken`.
- **`submitMerchant`:**
  - Owner only.
  - Allowed from DRAFT or REJECTED. Sets `submitted_at = now()`, clears `rejection_reason`.
- **Review actions:**
  - Implemented as a single guarded update: `UPDATE merchants SET status=$to, reviewed_by=$admin, reviewed_at=now(), … WHERE id=$id AND status = ANY($allowedFrom) RETURNING *`.
  - 0 rows → re-read the merchant. Missing → `NotFoundError`; otherwise → `ConflictError("invalid_transition", …)`.
  - `allowedFrom` comes from `canTransition`.
  - Reject stores `rejection_reason`.
- **`listMerchants`:** ordered by `submitted_at` ascending (nulls last), then `created_at`. `ownerEmail` comes from the owner membership's user.

- [ ] **Step 1: Write the failing integration tests.**
  - profile: owner edits description, contact and addresses in DRAFT. The patch returns the updated profile.
  - profile: staff edit → 403.
  - profile: APPROVED merchant changing `slug` → 409 `field_locked` listing `["slug"]`, and the row is unchanged.
  - profile: SUBMITTED edit → 409 `under_review`.
  - submit: DRAFT → SUBMITTED sets `submittedAt`. Submitting again → 409 `invalid_transition`.
  - submit: REJECTED → SUBMITTED clears `rejectionReason`.
  - review: approve SUBMITTED → APPROVED with `reviewedBy` = the admin id. Approving a DRAFT → 409.
  - review: reject stores the reason. Suspend APPROVED → SUSPENDED. Reinstate → APPROVED.
  - review: an unknown id → 404.
  - **review: concurrent approve and reject of the same SUBMITTED merchant → exactly one fulfilled; the other is rejected with `invalid_transition`; the final status equals the winner's.**
  - list: a `status: "SUBMITTED"` filter returns only submitted merchants, with `ownerEmail`.

  Test helper: `testAdmin(id): AdminActor` in `tests/support/merchant-fixtures.ts`, built as `{ admin: true, email, id, name, role: "admin" }`.

- [ ] **Step 2: Run the tests.** Run `bunx vitest run --project integration tests/integration/merchants`. Expected: the new tests FAIL.

- [ ] **Step 3: Implement `profile.ts` and `review.ts`.**

- [ ] **Step 4: Run the tests again.** Same command. Expected: PASS. Then run `bun run test`. Expected: all pass.

- [ ] **Step 5: Commit.** Message: `feat(merchants): profile editing, submission and admin review`.

---

### Task 6: Pickup locations and merchant authorization guards

**Files:**
- Create: `src/modules/merchants/application/pickup.ts`, `src/modules/merchants/index.ts`
- Test: `tests/integration/merchants/pickup.test.ts`

**Interfaces:**
- Produces:
  - `interface PickupLocation { id; label; contactName; phone; line1; line2: null|string; city; state; postalCode; isPrimary: boolean }`.
  - `listPickupLocations(db, ctx): Promise<PickupLocation[]>` (primary first).
  - `addPickupLocation(db, ctx, input: PickupLocationInput & { isPrimary?: boolean }): Promise<PickupLocation>`.
  - `updatePickupLocation(db, ctx, locationId: string, patch: Partial<PickupLocationInput> & { isPrimary?: boolean }): Promise<PickupLocation>`.
  - `src/modules/merchants/index.ts` (`import "server-only"`):
    - `getCurrentMerchant(): Promise<MerchantContext | null>`, wrapped in `cache()`, using `getSessionUser` and `findMerchantForUser(db, …)`.
    - `requireMerchant(nextPath: string): Promise<MerchantContext>`: no session → sign-in with `next`; no merchant → `redirect("/merchant/onboarding")`.
    - `requireApprovedMerchant(nextPath: string)`: as above, and any status other than APPROVED → `redirect("/merchant/onboarding")`.
    - `authorizeMerchant(): Promise<MerchantContext>`: `UnauthorizedError`, or `ForbiddenError("You do not have a shop yet.")`.
    - Re-exports the service functions and types.

**Rules:**
- Owner and staff may both manage pickup locations.
- Every query filters on `merchant_id = ctx.merchantId`. An id belonging to another merchant → `NotFoundError("Pickup location not found.")`.
- Setting `isPrimary: true` unsets the current primary in the same transaction.
- Setting `isPrimary: false` on the only primary → `ConflictError("primary_required", "Choose another primary pickup location first.")`.
- Pickup locations are never deleted in Phase 2, because Phase 7 shipments will reference them.

- [ ] **Step 1: Write the failing integration tests.**
  - Lists the onboarding pickup location as primary.
  - Adding a second location with `isPrimary: true` swaps the primary, so exactly one primary remains.
  - **Merchant B updating merchant A's location id → 404, and A's row is unchanged.**
  - Merchant B listing → never includes A's locations.
  - Unsetting the only primary → 409 `primary_required`.
  - Invalid postal code at the DB level (bypassing Zod with a raw insert) → rejected by the CHECK constraint.

- [ ] **Step 2: Run the tests.** Run `bunx vitest run --project integration tests/integration/merchants/pickup.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `pickup.ts` and `index.ts`.**

- [ ] **Step 4: Run the tests again.** Same command, then `bun run test` and `bun run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit.** Message: `feat(merchants): pickup locations and authorization guards`.

---

### Task 7: REST API under `/api/v1`

**Files:**
- Create:
  - `src/app/api/v1/merchant/onboarding/route.ts` (POST)
  - `src/app/api/v1/merchant/profile/route.ts` (GET, PATCH)
  - `src/app/api/v1/merchant/profile/submit/route.ts` (POST)
  - `src/app/api/v1/merchant/pickup-locations/route.ts` (GET, POST)
  - `src/app/api/v1/merchant/pickup-locations/[id]/route.ts` (PATCH)
  - `src/app/api/v1/admin/merchants/route.ts` (GET with `?status=`)
  - `src/app/api/v1/admin/merchants/[id]/route.ts` (GET)
  - `src/app/api/v1/admin/merchants/[id]/{approve,reject,suspend,reinstate}/route.ts` (POST)
- Test: `tests/e2e/merchant-api.spec.ts`, plus helpers in `tests/e2e/helpers.ts`

**Interfaces:**
- Consumes: `apiRoute`, `parseJson`, `ok` (Task 1); `authorizeSession`, `authorizeAdmin` (Task 2); merchants `index.ts` (Task 6); schemas (Task 3).
- Produces:
  - Response bodies:
    - `POST onboarding` → 201 `{ data: MerchantProfile }`.
    - Profile and submit routes → 200 `{ data: MerchantProfile }`.
    - Pickup routes → `{ data: PickupLocation | PickupLocation[] }`.
    - Admin list → `{ data: MerchantListItem[] }`.
    - Admin actions → `{ data: MerchantProfile }`.
  - E2E helpers: `onboardMerchant(page, overrides?)` (posts onboarding through `page.request` and returns the profile), `uniqueSlug(prefix)`, and `apiJson(response)`.

**Handler shape** (every handler):
1. `apiRoute`.
2. Authorize: `authorizeSession` for onboarding, `authorizeMerchant` for `/merchant/*` except onboarding, `authorizeAdmin` for `/admin/*`.
3. `parseJson` with the schema.
4. Call the service with `db` and the actor.
5. Return `ok(...)`.

Further rules:
- Onboarding uses the session user id. The **merchant id never comes from the request**.
- `[id]` params are read with `const { id } = await context.params`, typed `RouteContext<'/api/v1/…/[id]'>`.
- `?status` is validated with `z.enum(MERCHANT_STATUSES).optional()`.

- [ ] **Step 1: Write the failing E2E API tests** in `tests/e2e/merchant-api.spec.ts`, all through `page.request` after `signUp`:
  - signed-out `GET /api/v1/merchant/profile` → 401 with `error.code === "unauthorized"` and a `requestId`.
  - signed-in user without a shop: `GET profile` → 403.
  - onboarding happy path → 201, `data.status === "DRAFT"`. A second onboarding → 409 `already_merchant_owner`.
  - onboarding with a bad phone → 400 `validation_failed`, with `details.contactPhone` present.
  - PATCH profile, then submit → `SUBMITTED`. PATCH while submitted → 409 `under_review`.
  - non-admin `POST /api/v1/admin/merchants/<id>/approve` → 403, and the merchant is still `SUBMITTED`.
  - admin (granted via `grantAdminRole`) gets the list with `?status=SUBMITTED`, which contains the merchant. Approve → `APPROVED`. Approve again → 409 `invalid_transition`.
  - **isolation:** merchant B `PATCH /api/v1/merchant/pickup-locations/<A's id>` → 404. Then A's `GET` shows its location unchanged.
  - admin `GET /api/v1/admin/merchants?status=BOGUS` → 400.

  For rate limits, each test signs up at most 2 users. Use `browser.newContext()` with its own `x-forwarded-for` when a test needs a second user. Add `newClientContext(browser)` to the helpers.

- [ ] **Step 2: Run the tests.** Run `bun run test:e2e -- tests/e2e/merchant-api.spec.ts`. Expected: FAIL (404 for every route).

- [ ] **Step 3: Implement the route handlers.**

- [ ] **Step 4: Run the tests again.** Same command. Expected: PASS. Then run the full `bun run test:e2e`. Expected: all pass.

- [ ] **Step 5: Commit.** Message: `feat(api): merchant onboarding, profile, pickup and admin review endpoints`.

---

### Task 8: Merchant pages

**Files:**
- Create:
  - `src/app/merchant/layout.tsx`: shell only; no data and no guard beyond UX.
  - `src/app/merchant/onboarding/{page.tsx,page.client.tsx}`
  - `src/app/merchant/profile/{page.tsx,page.client.tsx}`
  - `src/app/merchant/settings/shipping/{page.tsx,page.client.tsx}`
  - `src/app/merchant/dashboard/page.tsx`
  - `src/app/merchant/merchant-fields.client.tsx`: shared field groups (store, contact, address, compliance).
- Modify: `src/ui/components/header/header.tsx` (add a "Sell on Gillu" link to `/merchant/onboarding`).
- Test: `tests/e2e/merchant-onboarding.spec.ts`

**Interfaces:**
- Consumes: Task 6 guards and services; the Task 7 API, which the client forms call with `fetch`.
- Produces: page routes, plus visible text that the E2E tests assert (exact copy below).

**Page behavior (decided):**
- **`/merchant/onboarding`:** `requireSession("/merchant/onboarding")`, then `getCurrentMerchant()`.
  - **No merchant:** the onboarding form.
    - The slug auto-fills from the store name with `suggestSlug` until the slug is edited by hand.
    - A "Return address same as business address" checkbox, default checked.
    - The pickup section defaults its address to the business address.
    - Compliance fields carry the hint "Optional. Gillu will confirm which registrations your shop needs."
    - The logo field is an optional **https URL** input. Upload UI arrives with the Phase 3 `ImageStorage` port.
    - Submit button: "Create shop". On success, `router.refresh()`.
  - **DRAFT:** heading "Your shop is a draft", a "Submit for review" button (calls the submit API), and an "Edit profile" link.
  - **SUBMITTED:** "Your shop is under review".
  - **REJECTED:** "Your shop needs changes", the rejection reason, "Edit profile", and "Submit for review".
  - **APPROVED:** `redirect("/merchant/dashboard")`.
  - **SUSPENDED:** "Your shop is suspended. Contact Gillu support."
- **`/merchant/profile`:** `requireMerchant("/merchant/profile")`, then `getMerchantProfile`.
  - The form shows locked fields (`lockedFieldsFor(status)`) as disabled, with the note "Locked after approval — contact Gillu to change".
  - Fields show as read-only for staff.
  - Saving issues `PATCH` and shows "Profile saved", or the API error message with field errors under each field.
  - The compliance block shows the badge "Unverified" when `complianceVerified` is false.
- **`/merchant/settings/shipping`:** `requireMerchant(...)`. Lists pickup locations (primary badge), with an add form and a "Make primary" action.
- **`/merchant/dashboard`:** `requireApprovedMerchant("/merchant/dashboard")`.
  - Shows heading `<storeName>`, badge "Approved", the shop URL `/shops/<slug>` (as text; the shop page arrives in Phase 4), the primary pickup location, and links to Profile and Shipping settings.
  - **No sales or product numbers** in this phase. No mock data (anti-goal).
- The client forms render the API's `error.message`. A 400 maps `details[field][0]` to that field.

- [ ] **Step 1: Write the failing E2E tests** in `tests/e2e/merchant-onboarding.spec.ts`:
  - **signed-out redirect:** signed-out `/merchant/onboarding` → `/auth/sign-in?next=%2Fmerchant%2Fonboarding`. After signing up via the sign-in page's link (which carries `next`), the user lands on `/merchant/onboarding`.
  - **onboarding form:** fill the form via UI (`fillFields`) and click "Create shop". "Your shop is a draft" is visible. Click "Submit for review", and "Your shop is under review" is visible.
  - **dashboard before approval:** `/merchant/dashboard` before approval redirects to `/merchant/onboarding`.
  - **validation in the UI:** an invalid phone in the UI shows a field error, and no shop is created (`GET /api/v1/merchant/profile` → 403).
  - **locked fields after approval:** the profile page for an approved merchant (approved via API as an admin in a second context) shows the store-name input disabled, and the "Unverified" badge is visible.
  - **suspension:** an approved merchant's dashboard is 200 and shows the store name. The admin suspends via API. The merchant's next `page.goto("/merchant/dashboard")` lands on `/merchant/onboarding`, and "suspended" is visible.

- [ ] **Step 2: Run the tests.** Run `bun run test:e2e -- tests/e2e/merchant-onboarding.spec.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the pages and the header link.**

- [ ] **Step 4: Run the tests again.** Same command. Then run the full `bun run test:e2e`. Expected: PASS.

- [ ] **Step 5: Commit.** Message: `feat(merchant): onboarding, profile, shipping settings and dashboard pages`.

---

### Task 9: Admin merchant review pages and Scenario A (to approval)

**Files:**
- Create: `src/app/admin/merchants/{page.tsx,page.client.tsx}`, `src/app/admin/merchants/[id]/{page.tsx,page.client.tsx}`
- Modify:
  - `src/app/admin/page.tsx`: keep the redirect, but point it to `/admin/merchants`.
  - Admin nav: links to Merchants and Summary.
- Test: `tests/e2e/admin-merchants.spec.ts`

**Behavior:**
- **List page:** `await requireAdmin()` **in the page**, then `listMerchants(db, admin, { status })`, with tabs for All / Submitted / Approved / Rejected / Suspended through `?status=`. An invalid status falls back to All. The table shows store name, slug, owner email, status and submitted date.
- **Detail page:** `requireAdmin()` in the page, then `getMerchantForAdmin`. It shows every onboarding field, the compliance block with "Unverified", and pickup locations.
  - Buttons for the allowed transitions only. Approve and Reject when SUBMITTED; Reject asks for a reason in a textarea (5–500 chars). Suspend when APPROVED. Reinstate when SUSPENDED.
  - The buttons call the Task 7 admin APIs, then `router.refresh()`.
- Both pages use the admin layout.
- The pages leak nothing to non-admins (Phase 1 lesson). Reuse the forged-RSC check.

- [ ] **Step 1: Write the failing E2E tests:**
  - **Scenario A through approval:**
    - A merchant signs up and onboards via UI, then submits.
    - In a second context, an admin (`grantAdminRole`) opens `/admin/merchants?status=SUBMITTED`, sees the store name, opens it and clicks "Approve". The status "APPROVED" is visible.
    - The merchant context reloads `/merchant/dashboard`: 200 with the store name and "Approved".
  - **rejection:** the admin rejects with the reason "Please add a return address in Bengaluru". The merchant's `/merchant/onboarding` shows "Your shop needs changes" and that reason.
  - **non-admin access:** a non-admin gets 404 on `/admin/merchants` and on `/admin/merchants/<id>`. The response body, both the plain HTML and the forged RSC request with a router-state tree claiming `/admin` is loaded, does not contain the merchant's contact email.

- [ ] **Step 2: Run the tests.** Run `bun run test:e2e -- tests/e2e/admin-merchants.spec.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the admin pages and nav.**

- [ ] **Step 4: Run the tests again.** Same command, then the full `bun run test:e2e`. Expected: PASS.

- [ ] **Step 5: Commit.** Message: `feat(admin): merchant review queue and approval actions`.

---

### Task 10: Docs, tracker, gate, Compose smoke

**Files:**
- Modify:
  - `docs/merchant-workflow.md`: states diagram, who can do what, locked fields, compliance flag.
  - `docs/api-contracts.md`: error shape and every Phase 2 endpoint with its status codes.
  - `docs/database-design.md`: merchants tables and migration 0002.
  - `docs/architecture.md`: merchants module and the authorization rule.
  - `docs/testing.md`: new suites.
  - `diagrams/decisions.md`: ADRs below.
  - `diagrams/implementation-progress.md`: Phase 2 checklist, verification and report.
  - `README.md`: if setup changed.

**New ADRs (Accepted):**
- **ADR-022:** API error contract and `{ data }` envelope.
- **ADR-023:** A user owns at most one merchant in MVP, enforced by a partial unique index. Staff memberships may be many. The current merchant is resolved owner-first, then by oldest membership. A switcher arrives with staff invitations.
- **ADR-024:** Field locking after approval (name, slug and compliance ids need admin help).
- **ADR-025:** Compliance identifiers are optional and unverified (`compliance_verified_at`) until Gillu confirms requirements per merchant type.

- [ ] **Step 1: Update the docs and ADRs.** In the tracker, set Phase 2 to COMPLETED **only after** Step 2 passes.
  - Mark Google OAuth as "code complete; manual verification NEEDS_INPUT (credentials)".
  - Do not mark Google verified.

- [ ] **Step 2: Run the gate.**
  - `bun run typecheck && bun run lint && bun run knip && bun run test && bun run test:e2e`. Expected: all exit 0.
  - Compose smoke:
    - `GILLU_ENV_FILE=<tmp env> docker compose --env-file <tmp env> up --build -d --wait`, then `docker compose logs migrate`. Expected: the migrate output shows 0002 applied.
    - `curl http://127.0.0.1:8080/api/health`. Expected: 200.
    - `curl http://127.0.0.1:8080/api/v1/merchant/profile`. Expected: 401 JSON with a `requestId`.
    - Then `docker compose down -v`. This removes only the gillu_* smoke volumes; never touch `relivator_postgres_data`.

- [ ] **Step 3: Append the Phase 2 report** (§29 template) to the tracker, with the real numbers from Step 2.

- [ ] **Step 4: Commit.** Message: `docs: Phase 2 merchant authentication report`.
