# Gillu Phase 4 — Customer Storefront Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Products carry their story (region, maker, handmade/homemade, ingredients) and shops carry theirs (story, village/town, photos), both required to publish; customers browse `/explore`, read product and shop pages, fill a guest cart, and sign in at a checkout entry point that stops before placing orders.

**Architecture:** Migration 0005 adds story columns, `merchant_story_images`, `carts` and `cart_items`. The catalog module gains story fields, new publish blockers and a storefront query layer (`application/storefront.ts`) that replaces `listPurchasableProducts`; the merchants module gains shop story (rules in `domain/story.ts`, images through the catalog `ImageStorage` port); a new `cart` module owns the server-side cart behind a hashed guest cookie with lazy merge on sign-in. Storefront pages live in a `(site)/(store)` route group sharing the Gillu site header/footer, with new CSS in `src/css/gillu-store.css` scoped like ADR-026.

**Tech Stack:** Next.js 16.4 App Router (`PageProps`, `RouteContext`, promise `params`/`searchParams`, `next/form`, `cookies()`), React 19.3, TypeScript 5.9, drizzle-orm 0.45 / drizzle-kit 0.31 on Postgres 16, Zod 4, better-auth 1.7, Vitest + Testcontainers, Playwright, bun.

**Spec:** `docs/superpowers/specs/2026-10-28-gillu-phase-4-storefront-design.md` (previous: `docs/superpowers/specs/2026-10-27-gillu-phase-3-catalog-and-ui-design.md`; requirements `diagrams/implementation-prompt.txt` Phase 4, §22, §29).

## Global Constraints

- Every Bash call: `export PATH=$HOME/.bun/bin:$PATH`.
- No fake data, no fake success. The checkout page never creates orders, reservations or payment calls; "Place order" is disabled with "Ordering opens soon — your cart is saved."
- Nothing on the storefront links to a non-purchasable product or to a shop page that would 404.
- Purchasable = PUBLISHED, `admin_hold_reason IS NULL`, shop APPROVED, category active, ≥ 1 active variant with `available > 0` (Phase 3 rule, unchanged). One shared condition builder; never re-typed per query.
- Price and stock always come from the database at read time; the browser is never trusted for either.
- Story field limits: `origin_place` 2–60, `made_by` 2–80, `composition` 3–1000, shop `story` 150–3000, `home_place` 2–60; all trimmed; blank → null on PATCH.
- `made_how` exactly `HANDMADE` | `HOMEMADE`; `composition_label` exactly `INGREDIENTS` | `MATERIALS` (default `INGREDIENTS`; `MATERIALS` for `art-and-handicrafts`, `home-and-festive-decor`, `handmade-gifts`).
- Story photos ≤ 6 per shop; product photos ≤ 8; both JPEG/PNG/WebP by magic bytes, ≤ 4 MB.
- Cart: ≤ 30 lines, quantity 1–10 per line; guest cookie `gillu_cart` (32 random bytes, base64url, `HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/`, max-age 30 days, refreshed on writes); only the SHA-256 hash is stored.
- Explore page size 24; sort values `newest` (default), `price_asc`, `price_desc`; made values `handmade`, `homemade`.
- Every page and route handler authorizes itself; API contract ADR-022 (`apiRoute`, `ok`, `parseJson`, `parseQuery`, `AppError` subclasses).
- Migrations additive only. Never touch `relivator_postgres_data` or the `gillu` Compose stack; Compose smoke runs as project `gillu-smoke`.
- The user's uncommitted edits in `src/app/merchant/merchant-fields.client.tsx` and `src/app/merchant/onboarding/page.client.tsx` are theirs: never stage, revert or reformat them; stage files by path, never `git add -A`.
- Phase 2/3 E2E ids and copy keep working.
- One commit per task with the message given, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. No push/merge.
- Library APIs new to this codebase (Next `cookies()` in route handlers, `next/form` search params) are checked with `npx ctx7@latest` before use.

## Review Focus

1. **A shop whose story is incomplete but has live products (pre-Phase-4 test data).** Expected: products stay purchasable; product page shows "Sold by <store>" with no link, cart group shows the store name with no link, `/shops/<slug>` 404s, nothing anywhere links to it. Pinned in Tasks 7, 10, 12.
2. **Guest cookie abuse.** A forged, stale or another browser's `gillu_cart` value; a guest cart cookie arriving with a signed-in session twice (double merge). Expected: unknown token → treated as no cart (a new one only on write); never reads another cart; second merge is a no-op. Pinned in Task 8.
3. **Stock and purchasability changing between add and checkout.** Product unpublished, held, shop suspended, category hidden, variant switched off or sold out after it was added. Expected: line stays, status `unavailable`/`sold_out`/`short`, checkout disabled with the reason; no 500. Pinned in Task 8.
4. **Hostile explore input.** `q` with `%`, `_`, `\`, 500 chars; `page=0`, `page=-3`, `page=99999`, `region=atlantis`, `sort=drop`. Expected: page renders (invalid filters ignored, out-of-range page → empty results with pagination back), API answers 400 `validation_failed`; LIKE wildcards matched literally. Pinned in Tasks 7, 9.
5. **Story text rendering.** Story/composition containing `<script>`, markdown, very long words, blank lines. Expected: rendered as plain paragraphs (React escaping, split on blank lines), long words wrap (`overflow-wrap: anywhere`), no horizontal scroll at 360 px. Pinned in Tasks 10, 11.

---

## File Structure

```
drizzle/0005_*.sql                                   migration (generated + hand-added data update)
src/db/schema/catalog/tables.ts                      + story columns, composition_label, enums
src/db/schema/merchants/tables.ts                    + story columns, merchantStoryImagesTable
src/db/schema/cart/{tables,relations}.ts             carts, cart_items (new)
src/modules/catalog/domain/indian-states.ts          INDIAN_STATES, isStateSlug, stateName
src/modules/catalog/domain/publishability.ts         + story blockers
src/modules/catalog/application/inspect-image.ts     shared byte/type/size checks (extracted)
src/modules/catalog/application/storefront.ts        searchStorefront, getStorefrontProduct, getStorefrontShop, storefrontHighlights, getVariantsForCart
src/modules/catalog/presentation/storefront-query.ts storefrontQuerySchema, parseStorefrontSearchParams
src/modules/merchants/domain/story.ts                isShopStoryComplete
src/modules/merchants/application/story.ts           getMerchantStory, updateMerchantStory, story images
src/modules/cart/{domain,application,presentation,index.ts}
src/app/api/v1/{products,shops,cart}/**               public + cart routes
src/app/api/v1/merchant/story/**                     story routes
src/app/(site)/(store)/{layout,explore,shops,cart,checkout}/**
src/ui/gillu/store/*                                 storefront components
src/css/gillu-store.css                              @scope (.gillu-site) storefront styles
```

---

### Task 1: Story domain and schemas

**Files:**
- Create: `src/modules/catalog/domain/indian-states.ts`, `src/modules/merchants/domain/story.ts`
- Modify: `src/modules/catalog/domain/constants.ts`, `src/modules/catalog/presentation/schemas.ts`, `src/modules/merchants/presentation/schemas.ts`
- Test: `tests/unit/catalog/indian-states.test.ts`, `tests/unit/catalog/schemas.test.ts`, `tests/unit/merchants/story.test.ts`

**Interfaces:**
- Produces:
  - `INDIAN_STATES: readonly { name: string; slug: string }[]` — 36 entries (28 states + 8 UTs), alphabetical by name; slugs lowercase-hyphenated (`andaman-and-nicobar-islands`, `dadra-and-nagar-haveli-and-daman-and-diu`, `jammu-and-kashmir`, `ladakh`, `lakshadweep`, `puducherry`, `delhi`, `chandigarh`, `goa`, `kerala`, `maharashtra`, `rajasthan`, …). `type StateSlug`; `isStateSlug(value: string): value is StateSlug`; `stateName(slug: StateSlug): string`.
  - constants: `MADE_HOW = ["HANDMADE", "HOMEMADE"] as const`, `type MadeHow`; `COMPOSITION_LABELS = ["INGREDIENTS", "MATERIALS"] as const`, `type CompositionLabel`; `MAX_STORY_IMAGES = 6`.
  - `productStoryShape` added to `productCreateSchema` (all optional: `originState`, `originPlace`, `madeBy`, `madeHow`, `composition`) and `productPatchSchema` (each nullable, blank → null). `type ProductStory`.
  - `categoryPatchSchema` / `categoryCreateSchema` accept optional `compositionLabel`.
  - merchants: `merchantStoryPatchSchema` (`story`, `homePlace`, `homeState`; each nullable, blank → null; partial; non-empty), `type MerchantStoryPatch`.
  - `isShopStoryComplete(s: { homePlace: null | string; homeState: null | string; images: number; story: null | string }): boolean`.

- [ ] **Step 1: Write the failing tests**

```ts
test("36 states and union territories with unique slugs", () => {
  expect(INDIAN_STATES).toHaveLength(36);
  expect(new Set(INDIAN_STATES.map((s) => s.slug)).size).toBe(36);
  expect(isStateSlug("goa")).toBe(true);
  expect(isStateSlug("atlantis")).toBe(false);
  expect(stateName("jammu-and-kashmir")).toBe("Jammu and Kashmir");
});
test("product story fields: trimmed, limits, blank clears on patch", () => {
  expect(productPatchSchema.parse({ originPlace: "  Malvan " })).toEqual({ originPlace: "Malvan" });
  expect(productPatchSchema.parse({ madeBy: "" })).toEqual({ madeBy: null });
  expect(productPatchSchema.safeParse({ originState: "atlantis" }).success).toBe(false);
  expect(productPatchSchema.safeParse({ madeHow: "FACTORY" }).success).toBe(false);
  expect(productPatchSchema.safeParse({ composition: "ab" }).success).toBe(false);
  expect(productPatchSchema.safeParse({ composition: "x".repeat(1001) }).success).toBe(false);
  expect(productPatchSchema.safeParse({ originPlace: "x".repeat(61) }).success).toBe(false);
  expect(productPatchSchema.safeParse({ madeBy: "x".repeat(81) }).success).toBe(false);
});
test("shop story: 150–3000 chars, blank clears, state from list", () => {
  expect(merchantStoryPatchSchema.safeParse({ story: "x".repeat(149) }).success).toBe(false);
  expect(merchantStoryPatchSchema.parse({ story: " " })).toEqual({ story: null });
  expect(merchantStoryPatchSchema.safeParse({ homeState: "nowhere" }).success).toBe(false);
  expect(merchantStoryPatchSchema.safeParse({}).success).toBe(false);
});
test("a shop story is complete with text, place, state and a photo", () => {
  const full = { homePlace: "Malvan", homeState: "maharashtra", images: 1, story: "x".repeat(150) };
  expect(isShopStoryComplete(full)).toBe(true);
  expect(isShopStoryComplete({ ...full, images: 0 })).toBe(false);
  expect(isShopStoryComplete({ ...full, story: null })).toBe(false);
});
```

- [ ] **Step 2: Run** `bun run test:unit -- tests/unit/catalog tests/unit/merchants` — Expected: FAIL (modules/exports missing).
- [ ] **Step 3: Implement** the Produces list. Story text keeps line breaks (trim the whole value only).
- [ ] **Step 4: Run** same command — Expected: PASS. `bun run typecheck` clean.
- [ ] **Step 5: Commit** `feat(catalog): story fields, Indian states and shop story rules`

---

### Task 2: Migration 0005

**Files:**
- Modify: `src/db/schema/catalog/tables.ts`, `src/db/schema/merchants/tables.ts`, `src/db/schema/index.ts`, relations files
- Create: `src/db/schema/cart/tables.ts`, `src/db/schema/cart/relations.ts`, `drizzle/0005_*.sql` (+ meta)
- Test: `tests/integration/catalog/migration-0005.test.ts`

**Interfaces:**
- Produces tables/columns:
  - `products`: `origin_state text`, `origin_place text`, `made_by text`, `made_how made_how` (pgEnum from `MADE_HOW`), `composition text`; indexes `products_origin_state_idx`, `products_made_how_idx`, `products_status_published_at_idx (status, published_at)`.
  - `categories`: `composition_label composition_label NOT NULL DEFAULT 'INGREDIENTS'`.
  - `merchants`: `story text`, `home_place text`, `home_state text`.
  - `merchantStoryImagesTable` `merchant_story_images` (`id`, `merchant_id` FK cascade, `storage_key`, `url`, `alt`, `width`, `height`, `bytes`, `content_type`, `sort_order` default 0, `created_at`, `updated_at`; index on `merchant_id`).
  - `cartsTable` `carts` (`id`, `user_id` unique FK→user cascade nullable, `guest_token_hash` unique nullable, `created_at`, `updated_at`; CHECK `carts_one_owner`: exactly one of the two is not null).
  - `cartItemsTable` `cart_items` (`id`, `cart_id` FK cascade, `variant_id` FK→product_variants cascade, `quantity int` CHECK `cart_items_quantity_range` 1..10, `unit_price_paise_seen bigint NOT NULL`, timestamps; unique `cart_items_cart_variant_unique (cart_id, variant_id)`; index on `variant_id`).
- Generated with `bun run db:generate`; then append to the SQL file: `UPDATE "categories" SET "composition_label" = 'MATERIALS' WHERE "slug" IN ('art-and-handicrafts','home-and-festive-decor','handmade-gifts');`

- [ ] **Step 1: Write the failing test** (pattern of the 0003/0004 migration tests: fresh Testcontainers DB with all migrations)

```ts
test("0005 adds story columns, story images and carts additively", async () => {
  const labels = await db.select({ slug: categoriesTable.slug, label: categoriesTable.compositionLabel }).from(categoriesTable);
  expect(labels.find((c) => c.slug === "handmade-gifts")?.label).toBe("MATERIALS");
  expect(labels.find((c) => c.slug === "snacks-and-sweets")?.label).toBe("INGREDIENTS");
  // a cart with both owners or neither is refused
  await expect(db.insert(cartsTable).values({ id: "c1" })).rejects.toThrow(/carts_one_owner/);
  // quantity 11 refused
  // (seed a guest cart + variant first) ... rejects.toThrow(/cart_items_quantity_range/)
});
```

- [ ] **Step 2: Run** `bun run test:integration -- tests/integration/catalog/migration-0005.test.ts` — Expected: FAIL (tables/columns missing).
- [ ] **Step 3: Implement** schema + `bun run db:generate`; read the generated SQL: it must contain only `CREATE TYPE`, `CREATE TABLE`, `ALTER TABLE … ADD COLUMN`, `CREATE INDEX`, `ADD CONSTRAINT` plus the appended `UPDATE` — no `DROP`, no `ALTER COLUMN … SET NOT NULL` on existing columns.
- [ ] **Step 4: Run** the test and `bun run test:integration` — Expected: PASS, all existing integration tests still pass.
- [ ] **Step 5: Commit** `feat(db): migration 0005 for product and shop stories and carts`

---

### Task 3: Product story in the catalog service

**Files:**
- Modify: `src/modules/catalog/domain/publishability.ts`, `application/products.ts`, `application/status.ts`, `application/categories.ts`, `index.ts`
- Test: `tests/unit/catalog/publishability.test.ts`, `tests/integration/catalog/story.test.ts`, `tests/integration/support/catalog.ts`

**Interfaces:**
- Consumes: Task 1 schemas, `isShopStoryComplete`; Task 2 columns.
- Produces:
  - `type PublishBlocker = "category" | "variant" | "image" | "origin" | "made_by" | "made_how" | "composition" | "shop_story"` (this order). `publishBlockers` input gains `{ composition: boolean; madeBy: boolean; madeHow: boolean; origin: boolean; shopStoryComplete: boolean }` (`origin` = state and place both set).
  - `createProduct` / `updateProduct` persist `originState`, `originPlace`, `madeBy`, `madeHow`, `composition`.
  - `ProductDetail` gains `originState`, `originPlace`, `madeBy`, `madeHow`, `composition` (all `null | …`), `compositionLabel: CompositionLabel`.
  - `updateProduct` on a PUBLISHED product refuses setting any story field to null when it currently has a value: `ConflictError("story_required", "A published product needs its story. Unpublish it first to clear this.")`.
  - `Category` gains `compositionLabel`; create/update accept it.
  - Test support: `completeStory(db, merchantId)` (story text, place, state, one story image row) and `storyInput()` (valid five fields) in `tests/integration/support/catalog.ts`; existing publish tests use them.

- [ ] **Step 1: Write the failing tests**

```ts
// unit
expect(publishBlockers({ activePricedVariants: 1, categoryActive: true, images: 1,
  origin: false, madeBy: false, madeHow: false, composition: false, shopStoryComplete: false }))
  .toEqual(["origin", "made_by", "made_how", "composition", "shop_story"]);
// integration
test("publishing needs every story field and a complete shop story", async () => {
  // product with image + variant, no story → 409 not_publishable, details.missing contains origin, made_by, made_how, composition, shop_story
  // fill product story → missing = ["shop_story"]; completeStory(shop) → publishes
});
test("a published product cannot lose a story field", async () => {
  // published product → updateProduct(..., { madeBy: null }) rejects { code: "story_required", status: 409 }
  // updateProduct(..., { madeBy: "Someone else" }) succeeds
});
test("a product published without a story stays published and can still be edited", async () => {
  // set status PUBLISHED via SQL with null story fields → updateProduct({ name }) ok; publishBlockers lists the missing fields
});
test("composition label follows the category", async () => {
  // product in handmade-gifts → getProduct().compositionLabel === "MATERIALS"
});
```

- [ ] **Step 2: Run** `bun run test:unit -- tests/unit/catalog && bun run test:integration -- tests/integration/catalog` — Expected: new tests FAIL; existing publish tests also fail on the new blockers until they use `completeStory`/`storyInput` (update them in Step 3).
- [ ] **Step 3: Implement.** `getProduct` reads the shop story (merchant columns + count of `merchant_story_images`) to compute `shopStoryComplete` with `isShopStoryComplete`; `publishProduct` keeps using `getProduct(tx, …).publishBlockers` under its existing lock.
- [ ] **Step 4: Run** the full unit + integration suites — Expected: PASS.
- [ ] **Step 5: Commit** `feat(catalog): product story fields and story publish blockers`

---

### Task 4: Shop story service and API

**Files:**
- Create: `src/modules/catalog/application/inspect-image.ts`, `src/modules/merchants/application/story.ts`, `src/app/api/v1/merchant/story/route.ts`, `src/app/api/v1/merchant/story/images/route.ts`, `src/app/api/v1/merchant/story/images/[imageId]/route.ts`
- Modify: `src/modules/catalog/application/images.ts` (use `inspectImage`), `src/modules/merchants/index.ts`
- Test: `tests/integration/merchants/story.test.ts`, `tests/e2e/story-api.spec.ts`

**Interfaces:**
- Consumes: `ImageStorage`, `getImageStorage`, `readImageUpload`, `imagePatchSchema`, `MerchantContext`, `authorizeMerchant`.
- Produces:
  - `inspectImage(bytes: Uint8Array): { contentType: ImageContentType; height: number; width: number }` — throws `image_too_large` (400) / `invalid_image` (400) exactly as Phase 3; `addProductImage` uses it (no behaviour change).
  - `interface MerchantStory { complete: boolean; homePlace: null | string; homeState: null | string; images: StoryImageView[]; story: null | string }`; `StoryImageView = { alt; height; id; sortOrder; url; width }`.
  - `getMerchantStory(db, ctx): Promise<MerchantStory>`
  - `updateMerchantStory(db, ctx, patch: MerchantStoryPatch): Promise<MerchantStory>` — refuses complete→incomplete while the shop has a PUBLISHED product: `ConflictError("story_required", "Your shop has products on sale, so its story must stay complete.")`.
  - `addStoryImage(db, storage, ctx, { alt?, bytes, name })`, `updateStoryImage(db, ctx, imageId, patch: ImagePatch)`, `deleteStoryImage(db, storage, ctx, imageId)` — limit 6 re-checked under a `merchants` row lock (`ConflictError("image_limit", "A shop can have up to 6 story photos.")`); delete of the last photo while the shop has a PUBLISHED product → `ConflictError("last_story_image", "Your shop has products on sale, so its story needs a photo. Upload another one first.")`; alt defaults to the store name; another shop's image id → 404. Stored file deleted if the insert fails (Phase 3 pattern).
  - Routes (all `authorizeMerchant()` — any shop status): `GET`/`PATCH /api/v1/merchant/story`; `POST /api/v1/merchant/story/images` (201); `PATCH`/`DELETE /api/v1/merchant/story/images/{imageId}` (`DELETE` → `ok(null)`).

- [ ] **Step 1: Write the failing tests** — integration: story patch round-trip and blank clears; seventh photo → `image_limit`; last photo with a published product → `last_story_image`, without → allowed; complete→incomplete with a published product → `story_required`; another shop's image → 404; a DRAFT shop can edit its story. E2E API: signed-out → 401 JSON with `requestId`; an approved merchant uploads `tests/fixtures/images/pixel.png` (local driver) and `GET` shows `images.length === 1`.
- [ ] **Step 2: Run** `bun run test:integration -- tests/integration/merchants/story.test.ts` and `bun run test:e2e -- tests/e2e/story-api.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same plus `bun run test:integration -- tests/integration/catalog/images.test.ts` (no regression) — Expected: PASS.
- [ ] **Step 5: Commit** `feat(merchants): shop story with photos and API`

---

### Task 5: Desk — product story inputs and category label

**Files:**
- Modify: `src/ui/gillu/desk/product-form.client.tsx`, `src/ui/gillu/desk/product-card.tsx`, `src/app/merchant/products/new/page.tsx`, `src/app/merchant/products/[id]/page.tsx`, `src/app/(starter)/admin/categories/page.client.tsx`
- Create: `src/ui/gillu/desk/story-fields.client.tsx`
- Test: `tests/e2e/merchant-products.spec.ts`, `tests/e2e/admin-catalog.spec.ts`, `tests/e2e/helpers.ts`

**Interfaces:**
- Consumes: Task 3 `ProductDetail` fields, `INDIAN_STATES`, `MADE_HOW`, `Category.compositionLabel`.
- Produces:
  - `StoryFields` inputs with ids `#originState` (select, first option "Choose a state"), `#originPlace` ("Village, town or district"), `#madeBy` ("Who made it", new-product form prefilled with the store name), radios named `madeHow` labelled "Handmade" / "Homemade", `#composition` labelled "Ingredients" or "Materials" from the selected category (changes live when the category changes).
  - Blocker copy (desk "Before you can publish:" list): `origin` "Say where it comes from (state and place)", `made_by` "Say who made it", `made_how` "Choose handmade or homemade", `composition` "List its ingredients" / "List its materials", `shop_story` "Finish your shop's story" linking to `/merchant/profile#story`.
  - PUBLISHED product with blockers → `.notice` "Customers see this product, but it is missing: <comma list>".
  - Desk product card shows a "Handmade"/"Homemade" badge when set.
  - Admin categories: per-row select "Ingredients or materials for <name>" (PATCH `compositionLabel`).
  - E2E helper `completeShopStory(page)` (PATCH story via API + upload `pixel.png`) and `fillProductStory(page)`; existing publish E2E tests call them.

- [ ] **Step 1: Write the failing E2E tests:** "publishing lists the missing story" (new product with image, Publish → list contains "Say who made it" and "Finish your shop's story"); "a merchant fills a product's story and publishes it" (fill fields, `completeShopStory`, Publish → `PUBLISHED` badge, reload shows the values); "the composition label follows the category" (select Handmade gifts → label "Materials"); admin sets a category to Materials.
- [ ] **Step 2: Run** `bun run test:e2e -- tests/e2e/merchant-products.spec.ts tests/e2e/admin-catalog.spec.ts` — Expected: new tests FAIL; existing publish tests fail until they call the helpers.
- [ ] **Step 3: Implement.** Details form keeps "send changed fields only".
- [ ] **Step 4: Run** same — Expected: PASS.
- [ ] **Step 5: Commit** `feat(merchant): product story inputs and publish checklist in the desk`

---

### Task 6: Desk — "Your story" on the profile page

**Files:**
- Create: `src/ui/gillu/desk/story-panel.client.tsx`
- Modify: `src/app/merchant/profile/page.tsx` (not `page.client.tsx` unless required; the user's uncommitted files are not touched), `src/css/gillu-desk.css` (append to the Phase 3 `@scope` block)
- Test: `tests/e2e/merchant-story.spec.ts`

**Interfaces:**
- Consumes: Task 4 routes and `getMerchantStory`.
- Produces: a `section#story` panel titled "Your story" with `#shopStory` (textarea, live count "N / 3000", hint "At least 150 characters"), `#homePlace` ("Village or town"), `#homeState` (state select), "Save story" button, a photo grid reusing the Phase 3 photo controls' labels ("Description of photo N", "Move photo N earlier/later", "Remove photo N"), `#storyImageFile` + "Upload photo", and a status line "Your story is complete." / "Your story is not complete yet — shoppers will see it on your shop page.".

- [ ] **Step 1: Write the failing E2E:** draft merchant fills story (160 chars), place, state, uploads a photo → "Your story is complete."; too-short story shows a field error under `#shopStory`; reorder and remove work.
- [ ] **Step 2: Run** `bun run test:e2e -- tests/e2e/merchant-story.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** same + `tests/e2e/merchant-onboarding.spec.ts tests/e2e/desk.spec.ts` (Phase 2 profile flows) — Expected: PASS.
- [ ] **Step 5: Commit** `feat(merchant): your story panel on the desk profile page`

---

### Task 7: Storefront queries and public read API

**Files:**
- Create: `src/modules/catalog/application/storefront.ts`, `src/modules/catalog/presentation/storefront-query.ts`, `src/app/api/v1/products/route.ts`, `src/app/api/v1/shops/[shop]/route.ts`, `src/app/api/v1/shops/[shop]/products/[product]/route.ts`
- Delete: `src/modules/catalog/application/purchasable.ts`, `tests/integration/catalog/purchasable.test.ts` (its cases move into the new test)
- Modify: `src/modules/catalog/index.ts`
- Test: `tests/integration/catalog/storefront.test.ts`, `tests/unit/catalog/storefront-query.test.ts`, `tests/e2e/storefront-api.spec.ts`

**Interfaces:**
- Produces:
  - `type StorefrontQuery = { category?: string; made?: "handmade" | "homemade"; page: number; q?: string; region?: StateSlug; sort: "newest" | "price_asc" | "price_desc" }`.
  - `storefrontQuerySchema` (strict, for the API; invalid → 400 `validation_failed`) and `parseStorefrontSearchParams(params: Record<string, string | string[] | undefined>): StorefrontQuery` (lenient: invalid values dropped, `page` < 1 or non-integer → 1, `q` trimmed and cut to 100 chars).
  - `interface StorefrontCard { coverImageUrl: null | string; madeBy: null | string; madeHow: MadeHow | null; name: string; originPlace: null | string; originState: null | StateSlug; priceFromPaise: number; productId: string; shopLinkable: boolean; shopSlug: string; slug: string; storeName: string }` (`shopLinkable` = shop story complete).
  - `searchStorefront(db, query): Promise<{ items: StorefrontCard[]; page: number; pageSize: 24; regionCounts: { count: number; name: string; slug: StateSlug }[]; total: number }>` — `regionCounts` over all purchasable products (ignores filters), states with ≥ 1 only, sorted by name. Search matches `products.name`, `made_by`, `origin_place`, `composition`, `merchants.store_name` with escaped ILIKE. `priceFromPaise` = min price over active in-stock variants. Sorts tie-break on `products.id`.
  - `interface StorefrontProduct extends StorefrontCard { categoryName; categorySlug; composition: null | string; compositionLabel; description: null | string; images: ProductImageView[]; shop: { coverUrl: null | string; homePlace: null | string; homeState: null | StateSlug; storeName; storyExcerpt: null | string } ; variants: { available: number; declaredMrpPaise: null | number; id: string; label: null | string; pricePaise: number }[] }` — active variants only, in sort order (sold-out ones included with `available: 0`); `storyExcerpt` = first 240 chars of the story cut at a word boundary.
  - `getStorefrontProduct(db, shopSlug, productSlug): Promise<StorefrontProduct | null>` (null unless purchasable).
  - `interface StorefrontShop { homePlace: string; homeState: StateSlug; images: StoryImageView[]; products: StorefrontCard[]; slug: string; story: string; storeName: string }`; `getStorefrontShop(db, shopSlug): Promise<StorefrontShop | null>` (null unless APPROVED and story complete; products newest first, all of them).
  - `storefrontHighlights(db): Promise<{ categories: { name: string; slug: string }[]; newest: StorefrontCard[]; regions: StateSlug[] }>` — newest 3; categories and regions that have ≥ 1 purchasable product.
  - `interface CartVariantInfo { available: number; coverImageUrl: null | string; merchantId: string; pricePaise: number; productName: string; productSlug: string; purchasable: boolean; shopLinkable: boolean; shopSlug: string; storeName: string; variantId: string; variantLabel: null | string }`; `getVariantsForCart(db: Executor, variantIds: string[]): Promise<CartVariantInfo[]>` — `purchasable` = product purchasable AND this variant active (stock judged separately via `available`).
  - Routes (no session; `GET` only): `/api/v1/products` (`parseQuery(request, storefrontQuerySchema)` → `searchStorefront`), `/api/v1/shops/{shop}` (404 `NotFoundError("Shop not found.")`), `/api/v1/shops/{shop}/products/{product}` (404 `NotFoundError("Product not found.")`).

- [ ] **Step 1: Write the failing tests.** Integration (seed 2 approved shops with complete stories, products in two states/categories/made values, plus one shop without a story): every Phase 3 exclusion (draft, unpublished, archived, held, hidden category, suspended shop, all variants sold out or inactive) absent from `searchStorefront`, `getStorefrontProduct` and `storefrontHighlights`; each filter alone and combined; `q` "kokum" matches composition, store name, made_by, place; `q` `"%"` and `"_"` match literally (no product has them → 0 results); sorts and pagination (25 products → page 2 has 1); `regionCounts`; product of the story-less shop is purchasable with `shopLinkable: false` and `getStorefrontShop` → null; `storyExcerpt` cut. Unit: `parseStorefrontSearchParams({ page: "-3", region: "atlantis", sort: "drop", q: "x".repeat(500) })` → `{ page: 1, sort: "newest", q: "x".repeat(100) }`. E2E API: `GET /api/v1/products?page=0` → 400 `validation_failed`; `GET /api/v1/shops/nope` → 404 JSON.
- [ ] **Step 2: Run** `bun run test:unit -- tests/unit/catalog/storefront-query.test.ts && bun run test:integration -- tests/integration/catalog/storefront.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** One exported-internal `purchasableProductConditions(): SQL[]` used by every query here.
- [ ] **Step 4: Run** the two commands + `bun run test:e2e -- tests/e2e/storefront-api.spec.ts` + `bunx knip` — Expected: PASS, knip clean.
- [ ] **Step 5: Commit** `feat(catalog): storefront search, product and shop queries with public API`

---

### Task 8: Cart module and API

**Files:**
- Create: `src/modules/cart/domain/line-status.ts`, `src/modules/cart/domain/constants.ts`, `src/modules/cart/application/cart.ts`, `src/modules/cart/presentation/{schemas,guest-cookie}.ts`, `src/modules/cart/index.ts`, `src/app/api/v1/cart/route.ts`, `src/app/api/v1/cart/items/route.ts`, `src/app/api/v1/cart/items/[variantId]/route.ts`
- Test: `tests/unit/cart/line-status.test.ts`, `tests/unit/cart/guest-cookie.test.ts`, `tests/integration/cart/cart.test.ts`, `tests/e2e/cart-api.spec.ts`

**Interfaces:**
- Consumes: `getVariantsForCart`, `getSessionUser`.
- Produces:
  - `MAX_CART_LINES = 30`, `MAX_LINE_QUANTITY = 10`.
  - `type LineStatus = "ok" | "price_changed" | "short" | "sold_out" | "unavailable"`; `lineStatus(l: { available: number; currentPricePaise: number; purchasable: boolean; quantity: number; seenPricePaise: number }): LineStatus` — precedence unavailable > sold_out (available 0) > short (quantity > available) > price_changed > ok.
  - `GUEST_CART_COOKIE = "gillu_cart"`; `newGuestToken(): string` (32 random bytes base64url); `hashGuestToken(token: string): string` (SHA-256 hex); `guestCookieOptions(production: boolean)` (HttpOnly, SameSite lax, Secure when production, path `/`, maxAge 30 days).
  - `type CartOwner = { guestToken: null | string; userId: null | string }`.
  - `interface CartLineView { available; coverImageUrl; productName; productSlug; quantity; seenPricePaise; status: LineStatus; unitPricePaise; variantId; variantLabel }`; `interface CartGroupView { lines: CartLineView[]; shopLinkable: boolean; shopSlug: string; storeName: string; subtotalPaise: number }`; `interface CartView { canCheckout: boolean; count: number; groups: CartGroupView[]; mergeDropped: number; totalPaise: number }` (`count` = sum of quantities; totals over `ok` + `price_changed` lines at current prices; `canCheckout` = ≥ 1 line and every line `ok`; groups ordered by first-added line).
  - `type CartCookie = { clear: true } | { set: string } | null`; `interface CartResult { cookie: CartCookie; view: CartView }`.
  - `getCart(db, owner): Promise<CartResult>`; `addCartItem(db, owner, { quantity, variantId }): Promise<CartResult>`; `updateCartItem(db, owner, variantId, { quantity } | { acknowledgePrice: true }): Promise<CartResult>`; `removeCartItem(db, owner, variantId): Promise<CartResult>`.
  - Errors: unknown variant → `NotFoundError("Product not found.")`; not purchasable → `ConflictError("not_purchasable", "This item is not available right now.")`; over stock → `ConflictError("insufficient_stock", "Only N left.", { available: N })`; 31st line → `ConflictError("cart_full", "Your cart can hold 30 different items.")`; quantity outside 1–10 → `validation_failed`; update/remove of a variant not in the cart → 404.
  - Merge (inside every call when `userId` and `guestToken` are both present and the guest cart exists): one transaction, locks both carts; sum quantities capped at 10 (not at stock); carry the guest `unit_price_paise_seen` when the user line is new; keep user lines first then guest lines by `created_at`, drop beyond 30 and report the dropped count in `mergeDropped` of that call's view only; delete guest cart; `cookie: { clear: true }`. Unknown guest token with a session → `cookie: { clear: true }`, nothing else.
  - Guest with no cookie: reads return an empty view and create nothing; the first add creates the cart and returns `cookie: { set: token }`; every guest write refreshes the cookie (`set` with the same token).
  - Routes: `GET /api/v1/cart`; `POST /api/v1/cart/items` (201); `PATCH`/`DELETE /api/v1/cart/items/{variantId}`; bodies via `parseJson` with `cartAddSchema` / `cartUpdateSchema` (which reject non-JSON content types as Phase 3 `parseJson` does); every response `cache-control: no-store`; handlers apply `CartResult.cookie` with `cookies()`.

- [ ] **Step 1: Write the failing tests.** Unit: precedence table for `lineStatus`; token hash deterministic, 64 hex chars, token ≥ 43 chars. Integration: guest add → cookie set, read with the token returns the line; read with another token returns empty; add same variant twice sums; over stock → `insufficient_stock` with `available`; 31st line → `cart_full`; draft product → `not_purchasable`; after add: price change → `price_changed`, acknowledge → `ok`; stock to 0 → `sold_out`; stock below quantity → `short`; unpublish/hold/suspend shop/hide category/switch variant off → `unavailable`; merge sums and caps at 10, drops beyond 30 with `mergeDropped`, deletes guest cart, second call is a no-op; concurrent adds of the same variant end with one line. E2E API: guest `POST /api/v1/cart/items` → 201 with `set-cookie: gillu_cart=…; HttpOnly; SameSite=Lax`; `content-type: text/plain` body → 400; `GET /api/v1/cart` → `no-store`.
- [ ] **Step 2: Run** `bun run test:unit -- tests/unit/cart && bun run test:integration -- tests/integration/cart` — Expected: FAIL.
- [ ] **Step 3: Implement.** Check the Next 16 `cookies()` set/delete API in route handlers with `npx ctx7@latest` first.
- [ ] **Step 4: Run** the commands + `bun run test:e2e -- tests/e2e/cart-api.spec.ts` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(cart): server-side guest cart with merge on sign-in`

---

### Task 9: Store layout, header cart, and `/explore`

**Files:**
- Create: `src/app/(site)/(store)/layout.tsx`, `src/app/(site)/(store)/explore/page.tsx`, `src/ui/gillu/store/{store-card.tsx,made-badge.tsx,explore-filters.client.tsx,pagination.tsx,cart-button.client.tsx,money.ts,empty.tsx}`, `src/css/gillu-store.css`
- Modify: `src/app/(site)/layout.tsx` (import the new CSS), `src/ui/gillu/site/site-header.client.tsx`, `src/ui/gillu/site/content.ts` (`SITE_NAV` hrefs become `/#…` so they work off the landing page; add "Explore" → `/explore`)
- Test: `tests/e2e/explore.spec.ts`

**Interfaces:**
- Consumes: Task 7 `searchStorefront`, `parseStorefrontSearchParams`, `INDIAN_STATES`, `listActiveCategories`; Task 8 `GET /api/v1/cart`.
- Produces:
  - Store layout: `<SiteHeader />`, `<main id="main" className="store">{children}</main>`, `<SiteFooter />`.
  - `CartButton` in the header: link to `/cart`, text "Cart", badge with `count` (hidden at 0); fetches `GET /api/v1/cart` on mount and listens for `window` event `"gillu:cart"` (`CustomEvent<{ count: number }>`) dispatched by every client cart write.
  - `StoreCard({ card }: { card: StorefrontCard })`: cover (`next/image` unoptimized, or the Phase 3 placeholder), `MadeBadge`, name, "From ₹N" (`formatRupees(paise)` in `money.ts`: `Intl.NumberFormat("en-IN", { currency: "INR", style: "currency", maximumFractionDigits: paise % 100 ? 2 : 0 })`), "Place, State", "by Maker"; links to `/shops/{shopSlug}/{slug}`.
  - `/explore`: heading "Explore Gillu"; `next/form` GET form with `#q` (search, label "Search"), `#region` ("Region", options "All regions" + `regionCounts` as "Name (count)"), `#category` ("Category"), radio group "Made" (All / Handmade / Homemade), `#sort` ("Sort": Newest / Price: low to high / Price: high to low); filters submit on change via the client island; "Clear all" link to `/explore`; result count "N finds"; grid of `StoreCard`; numbered pagination preserving filters; empty state "Nothing here yet — try fewer filters." with the squirrel and "Clear filters".
  - `export const metadata` title "Explore · Gillu".
  - `gillu-store.css` inside `@scope (.gillu-site)`; long words `overflow-wrap: anywhere`.

- [ ] **Step 1: Write the failing E2E** (seed via API: two approved merchants with complete stories, products in Goa/homemade/snacks and Rajasthan/handmade/art): filter by region shows only Goa items and the URL has `region=goa`; category and made filters; search "kokum"; `?page=-3&region=atlantis&sort=drop` renders 200 with all items; empty search shows the empty state; header cart badge hidden at 0; 360 px width no horizontal scroll (`document.documentElement.scrollWidth <= 360`).
- [ ] **Step 2: Run** `bun run test:e2e -- tests/e2e/explore.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** same + `tests/e2e/landing.spec.ts` (nav still works) — Expected: PASS.
- [ ] **Step 5: Commit** `feat(store): explore page with region, category and made filters`

---

### Task 10: Product page and add to cart

**Files:**
- Create: `src/app/(site)/(store)/shops/[shop]/[product]/page.tsx`, `src/ui/gillu/store/{gallery.client.tsx,buy-box.client.tsx,maker-panel.tsx,paragraphs.tsx}`
- Delete: `src/app/(starter)/products/` (page and `[id]`), plus starter components only they used (`src/ui/components/cart-client.tsx`, `src/ui/components/product-card.tsx` if knip reports them unused); starter header/footer `/products` links → `/explore`
- Test: `tests/e2e/product-page.spec.ts`

**Interfaces:**
- Consumes: `getStorefrontProduct`, `StoreCard`, `MadeBadge`, `formatRupees`, cart API, `"gillu:cart"` event.
- Produces:
  - Page: `notFound()` when `getStorefrontProduct` returns null. `generateMetadata` → title "<name> · Gillu", description = first 160 chars of description or composition, Open Graph image = cover.
  - Layout: `Gallery` (cover + thumbnail buttons "Show photo N", arrow keys move between thumbnails); `h1` name; `MadeBadge`; "From <Place>, <State>"; "Made by <madeBy>"; price (`formatRupees`) and, when MRP > price, `<s aria-label="MRP">₹MRP</s>`; `BuyBox`; description and composition rendered by `Paragraphs` (split on blank lines, React text only); heading "Ingredients" or "Materials"; `MakerPanel` when `shopLinkable` (cover photo, store name, place, `storyExcerpt`, link "Meet <store>" → `/shops/{shopSlug}`), otherwise the line "Sold by <store>" without a link.
  - `BuyBox`: variant radio group "Choose a size" only when there is more than one active variant or the single one has a label; sold-out variants disabled with "Sold out"; "Only N left" when `available ≤ 5`; quantity stepper (`#quantity`, "Decrease quantity"/"Increase quantity", 1 to `min(10, available)`); "Add to cart" → `POST /api/v1/cart/items`; on success the status line "Added to cart · View cart" (link `/cart`) and dispatch `"gillu:cart"`; on error the API message in a `role="alert"` line.
  - A not-purchasable product URL and an unknown one both render the 404 page.

- [ ] **Step 1: Write the failing E2E:** opening a card from `/explore` shows name, Homemade badge, "From Malvan, Maharashtra", "Made by …", ingredients heading; choose the 500 g variant, quantity 2, Add to cart → "Added to cart" and header badge 2; a sold-out variant is disabled; unpublished product URL → 404; product of a story-less shop shows "Sold by" with no link; composition `<script>alert(1)</script>` renders as text; `/products` → 404 (starter page gone).
- [ ] **Step 2: Run** `bun run test:e2e -- tests/e2e/product-page.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** same + `bunx knip` + `bun run typecheck` — Expected: PASS / clean.
- [ ] **Step 5: Commit** `feat(store): product pages with maker panel and add to cart`

---

### Task 11: Shop page (mockup A)

**Files:**
- Create: `src/app/(site)/(store)/shops/[shop]/page.tsx`, `src/ui/gillu/store/{shop-story.tsx,story-strip.client.tsx,mark-shop-seen.client.tsx}`
- Test: `tests/e2e/shop-page.spec.ts`

**Interfaces:**
- Consumes: `getStorefrontShop`, `StoreCard`, `Paragraphs`, `stateName`.
- Produces:
  - `SEEN_SHOPS_COOKIE = "gillu_seen_shops"`: comma-separated shop slugs, most recent last, max 50, `Path=/`, `SameSite=Lax`, max-age 1 year, not HttpOnly (written by the client island, read by the server). Exported from `src/ui/gillu/store/seen-shops.ts` with `parseSeenShops(value: string | undefined): string[]` and `withSeenShop(list: string[], slug: string): string[]`.
  - Page reads the cookie with `cookies()`: not seen → **full story** (eyebrow "<Place> · <State>", `h1` store name, `Paragraphs` story, photo grid cover large + rest small) then `h2` "From <store>" product grid; seen → `StoryStrip` ("<store> · <Place>, <State>" + button "Read their story" with `aria-expanded`, expanding the full story in place) above the products. Both layouts render on the server.
  - `MarkShopSeen` client island: on mount, writes the cookie with `withSeenShop` (so the next visit is "returning").
  - "Skip to products" link (`href="#products"`) at the top in both layouts; products section `id="products"`.
  - No purchasable products → "New finds coming soon." instead of the grid.
  - `notFound()` when `getStorefrontShop` is null; `generateMetadata` title "<store> · Gillu", OG image = story cover.

- [ ] **Step 1: Write the failing E2E** (fresh browser context): first visit shows the story paragraph text and the photos; reload shows the strip, story text hidden; "Read their story" expands it (`aria-expanded="true"`); "Skip to products" moves focus/scroll to `#products`; a shop without a complete story → 404; story containing a 300-char word at 360 px has no horizontal scroll; shop with no live products shows "New finds coming soon."
- [ ] **Step 2: Run** `bun run test:e2e -- tests/e2e/shop-page.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** Unit-test `parseSeenShops`/`withSeenShop` (dedupe, cap 50, ignores junk entries that are not slug-shaped) in `tests/unit/store/seen-shops.test.ts` first.
- [ ] **Step 4: Run** same + `bun run test:unit -- tests/unit/store` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(store): maker shop pages that fold the story for returning visitors`

---

### Task 12: Cart page and checkout entry point

**Files:**
- Create: `src/app/(site)/(store)/cart/page.tsx`, `src/app/(site)/(store)/checkout/page.tsx`, `src/ui/gillu/store/{cart-lines.client.tsx,cart-summary.tsx}`
- Test: `tests/e2e/cart-checkout.spec.ts`

**Interfaces:**
- Consumes: Task 8 cart service (pages call `getCart` server-side with the session user id and the `gillu_cart` cookie; pages never set cookies — a pending `clear`/`set` is applied by the next API call), cart API for edits, `requireSession("/checkout")`.
- Produces:
  - `/cart`: `h1` "Your cart"; a group per shop with `h2` store name (link to `/shops/{slug}` only when `shopLinkable`) and subtotal; each line: photo, product name (link to the product page when status is not `unavailable`), variant label, unit price, quantity stepper ("Decrease quantity of <name>" / "Increase quantity of <name>"), "Remove <name>", and the status message: `price_changed` "Price changed from ₹A to ₹B" + button "OK", `short` "Only N left — lower the quantity", `sold_out` "Sold out — remove it to continue", `unavailable` "No longer available — remove it to continue"; `mergeDropped > 0` → notice "N items from your earlier cart did not fit (30 items max)."; total; "Checkout" link to `/checkout` rendered as a disabled button with "Fix the items marked above to continue." when `canCheckout` is false; empty cart → squirrel empty state "Your cart is empty." + link "Explore Gillu" → `/explore`. Edits call the cart API, then `router.refresh()` and dispatch `"gillu:cart"`.
  - `/checkout`: `requireSession("/checkout")`; `h1` "Checkout"; the same groups read-only with totals; any non-`ok` line → notice "Some items need attention" + link "Back to cart"; button "Place order" `disabled` with the note "Ordering opens soon — your cart is saved."; empty cart → redirect to `/cart`. `metadata.robots = { index: false }`.

- [ ] **Step 1: Write the failing E2E:** guest adds items from two shops → `/cart` shows two groups with subtotals and total; change quantity and remove; merchant sets the variant's stock to 1 while the guest has 2 → "Only 1 left" and Checkout disabled; guest clicks Checkout → sign-in page with `next=/checkout` → signs up via the sign-up link → lands on `/checkout` with the same items and a disabled "Place order" with "Ordering opens soon — your cart is saved."; after sign-in, the next `GET /api/v1/cart` response clears the `gillu_cart` cookie and returns the same lines.
- [ ] **Step 2: Run** `bun run test:e2e -- tests/e2e/cart-checkout.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** same — Expected: PASS.
- [ ] **Step 5: Commit** `feat(store): cart page and checkout entry point`

---

### Task 13: Landing page wired to real products

**Files:**
- Modify: `src/app/(site)/page.tsx`, `src/ui/gillu/site/collection.client.tsx`, `src/ui/gillu/site/content.ts` (region → state slug map), `src/ui/gillu/site/hero.tsx` (Explore call to action → `/explore`)
- Test: `tests/e2e/landing.spec.ts`

**Interfaces:**
- Consumes: `storefrontHighlights`, `StoreCard`.
- Produces:
  - `page.tsx` becomes async, calls `storefrontHighlights(db)` and passes it to `Collection({ highlights })`.
  - `newest.length === 0` → the section renders exactly as today (preview tabs, cards, "A taste of what's to come", "Collection previews · Illustrative imagery").
  - Otherwise: real `StoreCard`s (newest, up to 3); the tab row is replaced by links for `highlights.categories` (→ `/explore?category=<slug>`) and "Explore everything" (→ `/explore`); the eyebrow and the disclaimer are removed.
  - Region cards: `REGION_STATE: Record<RegionKey, StateSlug> = { goa: "goa", kerala: "kerala", maharashtra: "maharashtra", rajasthan: "rajasthan" }`; a region in `highlights.regions` links to `/explore?region=<slug>`; otherwise the card shows "Coming soon" and is not a link (no `href`, no button role).
  - Hero primary call to action links to `/explore`.

- [ ] **Step 1: Write the failing tests.** E2E (the shared E2E database accumulates products across specs, so assert only what this spec seeds): publish a Goa homemade product → the Goa region card links to `/explore?region=goa`; the collection shows real cards (at least the new product's card, linking to its product page) and "Explore everything"; the hero "Explore" call to action goes to `/explore`; Lakshadweep is never seeded, so test the "Coming soon" branch through the unit test below. Existing landing tests that assert the preview cards move to the unit test. Unit (`tests/unit/site/collection.test.tsx`, `react-dom/server` `renderToStaticMarkup`): `{ newest: [], categories: [], regions: [] }` renders "Collection previews · Illustrative imagery" and the three preview tabs; `regions: ["goa"]` renders the Kerala card with "Coming soon" and no link.
- [ ] **Step 2: Run** `bun run test:unit -- tests/unit/site && bun run test:e2e -- tests/e2e/landing.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** same + `bun run test:unit` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(site): landing collection and regions use real products`

---

### Task 14: Docs, tracker, full gate and Compose smoke

**Files:**
- Modify: `docs/architecture.md`, `docs/database-design.md` (0005, ER), `docs/api-contracts.md` (public products/shops, cart, merchant story, new error codes `story_required`, `last_story_image`, `not_purchasable`, `insufficient_stock`, `cart_full`), `docs/merchant-workflow.md` (story requirements), `docs/testing.md`, `README.md`, `diagrams/decisions.md` (ADR-031 story required to publish; ADR-032 server-side guest cart with hashed cookie and lazy merge; ADR-033 storefront URLs under the shop; ADR-034 seen-shops cookie), `diagrams/implementation-progress.md` (Phase 4 COMPLETED with checkboxes, Verification table, Phase 4 report in the §29 format; Current Phase → Phase 5)
- Test: full gate

- [ ] **Step 1:** Run the gate, each to a log file in the plan workspace: `bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test:unit`, `bun run test:integration`, `bun run test:e2e`. Expected: all exit 0; record counts.
- [ ] **Step 2:** Compose smoke as project `gillu-smoke` (throwaway env, port 18080, override renaming containers — Phase 3 pattern): `migrate` exits 0; `drizzle.__drizzle_migrations` has 6 rows; `carts`, `cart_items`, `merchant_story_images` exist; `GET /` 200; `GET /explore` 200; `GET /api/v1/products` 200 `{ data: { items: [] … } }`; `GET /api/v1/cart` 200 empty cart with `no-store`; `GET /api/v1/shops/nope` 404 JSON with `requestId`. Then `down -v` for `gillu-smoke` only; confirm `gillu_*` and `relivator_postgres_data` volumes still exist.
- [ ] **Step 3:** Write the docs and tracker with the real numbers.
- [ ] **Step 4:** `bunx biome check docs diagrams README.md` clean.
- [ ] **Step 5: Commit** `docs: Phase 4 storefront report`
