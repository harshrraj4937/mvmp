# Gillu Phase 3 — Catalog + Gillu UI Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the Gillu landing page and merchant desk from `/opt/NH/gillu` into the Next.js app, and build real product management (categories, products with variants, images, status, inventory) so an approved merchant can publish real products.

**Architecture:** Starter routes move into a `(starter)` route group so `/` (Gillu site) and `/merchant/*` (Gillu desk) render without the Relivator header/footer. Gillu's CSS is copied and wrapped in `@scope`; markup and JS become TSX server components with small client islands. A new `catalog` module (domain/application/presentation/infrastructure) owns categories, products, variants, images, inventory, with an `ImageStorage` port (local-disk + UploadThing adapters) and `/api/v1` routes on the ADR-022 contract.

**Tech Stack:** Next.js 16.4 App Router, React 19.3, TypeScript 5.9, drizzle-orm 0.45 / drizzle-kit 0.31 on Postgres 16, Zod 4, better-auth 1.7, UploadThing 7 (`UTApi`), Vitest + Testcontainers, Playwright, bun.

**Spec:** `docs/superpowers/specs/2026-10-27-gillu-phase-3-catalog-and-ui-design.md` (parent: `docs/superpowers/specs/2026-10-27-gillu-marketplace-design.md`; requirements `diagrams/implementation-prompt.txt` §9, Phase 3, §29).

## Global Constraints

- Every Bash call: `export PATH=$HOME/.bun/bin:$PATH`.
- Landing source = `/opt/NH/gillu` **commit `eacfe57`** (`git -C /opt/NH/gillu show eacfe57:<path>`); desk source = `/opt/NH/gillu/gillu-merchant-html/` (working tree, `2766b1f`). Never port `shop.html`, `shop.js`, `shop.css`, `data.js`, simulator, journey player, demo badge, localStorage state.
- No fake data anywhere in the app. Screens without a backend are hidden.
- Gillu CSS is kept (copied), wrapped in `@scope (.gillu-site)` / `@scope (.gillu-desk)`; no Tailwind/shadcn inside those trees.
- Money is integer paise (`bigint` columns, `number` in TS); currency `INR`.
- Product statuses exactly: `DRAFT`, `PENDING_APPROVAL`, `PUBLISHED`, `UNPUBLISHED`, `ARCHIVED`. `PENDING_APPROVAL` is never set in this phase.
- Seeded categories exactly (in this order): Regional packaged food, Snacks and sweets, Cashews and dry fruits, Art and handicrafts, Home and festive decor, Handmade gifts, Other regional products.
- Selling price label: "Price customers pay (including delivery)". MRP label: "Declared MRP (as printed on the pack, if any)". Price ≤ MRP when MRP given.
- Images: JPEG/PNG/WebP by magic bytes, ≤ 4 MB (4 × 1024 × 1024 bytes), ≤ 8 per product.
- Low stock threshold: `available ≤ 5`.
- Every page and route handler authorizes itself; layouts are UX only.
- API contract ADR-022 (`apiRoute`, `ok`, `parseJson`, `AppError` subclasses from `~/platform/{http,errors}`).
- Migrations additive only. Never touch `relivator_postgres_data` or the running `gillu` Compose stack; Compose smoke runs as project `gillu-smoke` (Phase 2 pattern).
- Phase 2 E2E ids and copy (e.g. `#storeName`, `#slug`, "Create shop", "Your shop is a draft", "Submit for review", "Your shop is under review", "Your shop needs changes", "Profile saved", "Save profile", "Unverified", "Approved") must keep working.
- One commit per task, message given in the task, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. No push/merge.
- Library APIs (UploadThing `UTApi`, `next/font/local`, `image-size`) are checked with `npx ctx7@latest` before use.

## Review Focus

1. **Messy rupee input** — `"₹1,299"`, `"1299.5"`, `" 1299 "`, `"1299.505"`, `"0"`, `"-5"`, `""` for MRP, MRP below price. Expected: first three accepted (129900 / 129950 / 129900 paise), the rest rejected with a field message, blank MRP = none, MRP < price → `mrp` field error. Pinned in Task 4 (`parseRupees`) and Task 7 (`variantFieldsSchema`).
2. **Spoofed uploads** — an HTML or SVG file renamed `.jpg`, a GIF, a 4 MB + 1 byte JPEG, a ninth image. Expected: `400 invalid_image` / `400 image_too_large` / `409 image_limit`, nothing stored. Pinned in Task 8.
3. **Removing what a published product needs** — deactivating its last active variant, or an admin deactivating its category. Expected: last variant → `409 last_variant`; category deactivation allowed but the product drops out of `listPurchasableProducts` and cannot be (re)published. Pinned in Tasks 7 and 9.
4. **Suspended shop** — a shop suspended after publishing. Expected: its products vanish from `listPurchasableProducts`, its members get `403` from catalog APIs and are redirected from desk product pages. Pinned in Tasks 9 and 10.
5. **Small screens and keyboard on the landing page** — 360 px width, mobile nav, Escape in dialogs. Expected: no horizontal scroll, nav closes after choosing a link, Escape closes a dialog and focus returns to the button that opened it. Pinned in Task 2.

---

## File Structure

```
src/app/layout.tsx                         root: html/body/providers only (no header/footer)
src/app/(starter)/layout.tsx               Relivator Header + main + Footer (moved from root)
src/app/(starter)/{auth,admin,dashboard,products,notifications}/…   moved, URLs unchanged
src/app/(site)/layout.tsx                  .gillu-site wrapper, fonts, site CSS
src/app/(site)/page.tsx                    landing page
src/app/merchant/layout.tsx                .gillu-desk shell (rewritten)
src/app/merchant/products/{page,new/page,[id]/page}.tsx (+ .client.tsx)
src/app/(starter)/admin/{categories,products}/page.tsx (+ client)
src/app/api/v1/{categories,merchant/products/**,merchant/variants/**,admin/categories/**,admin/products/**,images/[...key]}/route.ts
src/css/gillu-site.css, src/css/gillu-desk.css     scoped copies
src/ui/gillu/fonts.ts                      next/font/local Fraunces + DM Sans
src/ui/gillu/site/*.tsx                    landing sections + client islands
src/ui/gillu/desk/*.tsx                    shell, icons, modal, panels
src/lib/slug.ts                            suggestSlug moved here (shared)
src/modules/catalog/
  domain/{money,sku,product-status,publishability}.ts
  application/{categories,products,variants,inventory,images,status,admin,purchasable,image-storage}.ts
  infrastructure/{local-image-storage,uploadthing-image-storage,image-type}.ts
  presentation/schemas.ts
  index.ts
src/db/schema/catalog/{tables,relations}.ts
drizzle/0003_*.sql (generated), drizzle/0004_seed_categories.sql (custom)
public/gillu/{hero,clay,basket,hands,sweets,onam,pongal}.webp, favicon.svg
public/gillu/fonts/font-{0..8}.ttf, DM-Sans-OFL.txt, Fraunces-OFL.txt
tests/unit/gillu/scoped-css.test.ts
tests/unit/catalog/{money,sku,product-status,publishability,image-type}.test.ts
tests/integration/catalog/{categories,products,inventory,images,status,purchasable}.test.ts
tests/integration/support/catalog.ts
tests/e2e/{landing,desk,catalog-api,merchant-products,admin-catalog}.spec.ts
```

---

### Task 1: Route groups, Gillu assets, fonts and scoped CSS

**Files:**
- Modify: `src/app/layout.tsx` (keep html/body, ThemeProvider, NextSSRPlugin, CartProvider, Toaster, SpeedInsights; remove Header/main/Footer and the gradient body classes)
- Create: `src/app/(starter)/layout.tsx` (Header showAuth, `<main className="flex min-h-screen flex-col">`, Footer, wrapper div carrying the old gradient/text classes)
- Move (git mv, URLs unchanged): `src/app/{auth,admin,dashboard,products,notifications}` and `src/app/page.tsx` → `src/app/(starter)/…`. The Relivator home stays at `/` until Task 2 deletes it (`signOut` in `tests/e2e/helpers.ts` waits for `/`, and `health.spec.ts` requests it)
- Create: `public/gillu/*` (7 webp from `eacfe57:assets/`, `favicon.svg`), `public/gillu/fonts/*` (9 ttf + 2 OFL txt)
- Create: `src/ui/gillu/fonts.ts`, `src/css/gillu-site.css`, `src/css/gillu-desk.css`
- Modify: `THIRD-PARTY-NOTICES.md` (create if absent) — Gillu fonts (OFL) and illustrative images provenance from `/opt/NH/gillu/THIRD-PARTY-NOTICES.md`
- Test: `tests/unit/gillu/scoped-css.test.ts`

**Interfaces:**
- Produces: `fraunces`, `dmSans` (`next/font/local` objects with `.variable` = `--font-fraunces`, `--font-dm-sans`) from `~/ui/gillu/fonts`; CSS files importable as `~/css/gillu-site.css`, `~/css/gillu-desk.css`; images at `/gillu/<name>.webp`.

Font map (from source `@font-face`): DM Sans 400/500/600/700 = font-0/1/2/3; Fraunces italic 400/500 = font-4/5; Fraunces normal 400/500/600 = font-6/7/8.

CSS conversion rules (both files): drop `@font-face`; replace `'Fraunces'`/`'DM Sans'` family names in `--display`/`--body` with `var(--font-fraunces)`/`var(--font-dm-sans)`; `url(./assets/x)` → `url(/gillu/x)`; wrap everything except `@keyframes` in `@scope (.gillu-site) { … }` (desk: `.gillu-desk`); inside, `:root` and `body` selectors become `:scope`; `body.dialog-open` → `:scope.dialog-open`; `html{scroll-behavior…}` becomes an unscoped `html:has(.gillu-site){…}`. Desk file: delete rules whose selectors only target `.demo-badge`, `.simulator*`, `.journey*`, `.notification-*` (spec §4.2/§4.5).

- [ ] **Step 1: Write the failing test** `tests/unit/gillu/scoped-css.test.ts`

```ts
test.each([["src/css/gillu-site.css", ".gillu-site"], ["src/css/gillu-desk.css", ".gillu-desk"]])(
  "%s is fully scoped",
  (file, scope) => {
    const css = readFileSync(file, "utf8");
    expect(css).toContain(`@scope (${scope})`);
    expect(css).not.toMatch(/@font-face/);
    expect(css).not.toMatch(/(^|[}\s,]):root\b/);
    expect(css).not.toMatch(/(^|[}\s,])body\s*[{.,:]/);
    expect(css).not.toMatch(/url\(\.\/assets/);
    // every top-level block is @scope, @keyframes, @media wrapping @scope, or html:has(scope)
    expect(topLevelBlocks(css).every((b) => /^@scope|^@keyframes|^html:has\(/.test(b))).toBe(true);
  },
);
test("desk css has no demo-only rules", () => {
  expect(readFileSync("src/css/gillu-desk.css", "utf8")).not.toMatch(/\.(demo-badge|simulator|journey)/);
});
```
(`topLevelBlocks` is a small brace-depth splitter defined in the test file.)

- [ ] **Step 2: Run** `bun run test:unit -- tests/unit/gillu/scoped-css.test.ts` — Expected: FAIL (files missing).
- [ ] **Step 3: Copy assets, write `fonts.ts`, write both CSS files per the rules above; restructure layouts and move routes.**
- [ ] **Step 4: Run** the unit test — Expected: PASS. Then `bun run typecheck && bun run lint && bun run test:e2e` — Expected: all Phase 1–2 E2E pass (27).
- [ ] **Step 5: Commit** `refactor(app): starter route group, Gillu assets, fonts and scoped CSS`

---

### Task 2: Landing page at `/`

**Files:**
- Create: `src/app/(site)/layout.tsx` (imports `~/css/gillu-site.css`; `<div className={`gillu-site ${fraunces.variable} ${dmSans.variable}`}>`; metadata: title "Gillu — A little India. A lot of heart.", description from source `<meta name="description">`, `themeColor: "#73392e"`, icon `/gillu/favicon.svg`, OG image `/gillu/hero.webp`)
- Create: `src/app/(site)/page.tsx`
- Delete: `src/app/(starter)/page.tsx` (Relivator home) and components only it used (knip will list them)
- Create: `src/ui/gillu/site/{site-icons,site-header,hero,collection,celebrations,story,values,how-it-works,seller-section,early-access,site-footer,gillu-dialog}.tsx`; client islands named `*.client.tsx` (`mobile-nav.client.tsx`, `collection.client.tsx`, `festival-tabs.client.tsx`, `regions.client.tsx`, `early-access.client.tsx`)
- Create: `src/ui/gillu/site/content.ts` — the `festivals`, `productDetails`, `regions` objects from `eacfe57:app.js` as typed constants
- Test: `tests/e2e/landing.spec.ts`

**Interfaces:**
- Produces: `<GilluDialog open onClose labelledBy>` (native `<dialog>` via ref + `showModal()`, Escape/close button/backdrop close, returns focus to the opener, toggles `dialog-open` on the `.gillu-site` root); `<SiteIcons/>` sprite and `<Icon name/>` used by site components.

Markup comes from `eacfe57:index.html` section by section (classes and copy unchanged) with these edits only (spec §4.3): seller section's button becomes `<Link href="/merchant/onboarding" className="button primary">Start selling</Link>` and the seller dialog + download form are not ported; header/footer "Sell on Gillu"/"Become a Gillu seller" → `#sell`; any "Shop" link → `#discover`; header gains a "Sign in" link to `/auth/sign-in`. Images use `next/image` with the source `alt` text, `priority` on the hero.

- [ ] **Step 1: Write the failing E2E** `tests/e2e/landing.spec.ts`

```ts
test("landing page renders every section without demo wording", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  for (const id of ["discover", "celebrations", "our-story", "sell", "early-access"]) {
    await expect(page.locator(`#${id}`)).toBeVisible();
  }
  await expect(page.getByText(/demo store/i)).toHaveCount(0);
  await expect(page.locator('a[href*="shop.html"], a[href*="gillu-merchant-html"]')).toHaveCount(0);
});
test("collection filter and product dialog", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Handcrafted" }).click();
  await expect(page.locator("#discover article:visible")).toHaveCount(1);
  await page.getByRole("button", { name: "All finds" }).click();
  await expect(page.locator("#discover article:visible")).toHaveCount(3);
  const opener = page.locator("#discover article").first().getByRole("button").first();
  await opener.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(opener).toBeFocused();
});
test("festival tabs work with the keyboard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: /Onam/ }).click();
  await expect(page.getByRole("tab", { name: /Onam/ })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /Pongal/ })).toBeFocused();
  await expect(page.getByRole("tab", { name: /Pongal/ })).toHaveAttribute("aria-selected", "true");
});
test("early access collects nothing; Start selling goes to onboarding", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Be part of the beginning/ }).click();
  await expect(page.getByRole("dialog")).toContainText("No contact information is being collected");
  await expect(page.getByRole("dialog").locator("input")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.locator("#sell").getByRole("link", { name: "Start selling" }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in\?next=%2Fmerchant%2Fonboarding$/);
});
test("phone width: no horizontal scroll and the mobile nav closes after a choice", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.getByRole("button", { name: /menu/i }).click();
  await page.locator("#mobile-nav").getByRole("link", { name: "Discover" }).click();
  await expect(page.locator("#mobile-nav")).toBeHidden();
});
```
(Exact button/tab names are the ones in `eacfe57:index.html`; adjust the locator text to the source copy, not the other way round, and record any difference as a ruling.)

- [ ] **Step 2: Run** `bun run test:e2e -- tests/e2e/landing.spec.ts` — Expected: FAIL (Relivator home has none of the sections).
- [ ] **Step 3: Implement the layout, sections and islands.**
- [ ] **Step 4: Run** the landing spec, then the full `bun run test:e2e` — Expected: all pass.
- [ ] **Step 5: Visual check** — serve `eacfe57` statically (`git -C /opt/NH/gillu worktree add` to a temp dir outside both repos, `python3 -m http.server 8090`) and screenshot source vs port at 360, 768, 1366 px with Playwright into the plan workspace; list differences in the ledger (not claimed pixel-perfect). Remove the temp worktree after.
- [ ] **Step 6: Commit** `feat(site): Gillu landing page at /`

---

### Task 3: Merchant desk shell and Phase 2 pages in the desk design

**Files:**
- Rewrite: `src/app/merchant/layout.tsx` (imports `~/css/gillu-desk.css`; `.gillu-desk` + font variables; renders `<DeskShell>`)
- Create: `src/ui/gillu/desk/{desk-icons,icon,desk-shell,desk-nav.client,desk-search.client,modal.client,page-heading,panel,badge,empty-state}.tsx`
- Create: `src/app/merchant/{loading,error}.tsx` (desk loading/error-retry states)
- Modify (presentation only, keep ids/copy): `src/app/merchant/{onboarding,profile,settings/shipping,dashboard}/page*.tsx`, `src/app/merchant/merchant-fields.client.tsx`. Profile page gets the source `renderProfile` layout: store card (cover `/gillu/hands.webp`, initials avatar, store name, description, city pill from business address; eyebrow "YOUR GILLU STORE" instead of "A GILLU DEMO MERCHANT") beside a "Store details" panel holding the existing form
- Test: `tests/e2e/desk.spec.ts`

**Interfaces:**
- Consumes: `getCurrentMerchant()` from `~/modules/merchants` (layout uses it only to pick nav items and initials; pages still guard themselves).
- Produces: `<DeskShell merchant={{ initials, storeName, status } | null} activePath>`; `<PageHeading title subtitle action?>` (source `heading()`); `<Panel title?>`; `<DeskBadge tone="delivered"|"neutral"|"warning"|"danger">`; `<EmptyState icon title body action?>`; `<Modal open onClose title subtitle>` (native dialog, same focus rules as `GilluDialog`); `<Icon name/>` over the 29-symbol sprite from `gillu-merchant-html/index.html`.

Nav (spec §4.4): APPROVED shop → Overview `/merchant/dashboard`, Products `/merchant/products`, Store profile `/merchant/profile`, Shipping `/merchant/settings/shipping`. Not approved → Store profile, Shipping, and "Shop status" `/merchant/onboarding`. No shop → minimal frame (brand only). Never Orders/Reviews, no bell, no "DEMO MODE". Topbar: breadcrumb "Merchant workspace / <page>", search input (`/` focuses it; submits `GET /merchant/products?q=`; shown only for APPROVED), initials button → `/merchant/profile`. Headings from source: dashboard "A good day starts here.", profile "Your store, your story.", shipping uses `settings-layout`/`panel settings-group`. Workspace-preference toggles are not ported.

- [ ] **Step 1: Write the failing E2E** `tests/e2e/desk.spec.ts`

```ts
test("an approved merchant sees the desk with real nav only", async ({ browser, page }) => {
  await approvedMerchant(browser, page, "Channapatna Toys");   // helper added in this task
  await page.goto("/merchant/dashboard");
  const nav = page.getByRole("navigation", { name: "Merchant navigation" });
  for (const name of ["Overview", "Products", "Store profile", "Shipping"]) {
    await expect(nav.getByRole("link", { name })).toBeVisible();
  }
  await expect(nav.getByRole("link", { name: /Orders|Reviews/ })).toHaveCount(0);
  await expect(page.getByText(/demo mode|sample/i)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "A good day starts here." })).toBeVisible();
  await page.keyboard.press("/");
  await expect(page.getByRole("searchbox")).toBeFocused();
});
test("a draft shop sees no Products link", async ({ page }) => {
  await signUpFresh(page, "draftdesk");
  await onboardMerchant(page);
  await page.goto("/merchant/onboarding");
  await expect(page.getByRole("link", { name: "Products" })).toHaveCount(0);
  await expect(page.getByText("Your shop is a draft")).toBeVisible();
});
```
Add to `tests/e2e/helpers.ts`: `approvedMerchant(browser, page, storeName): Promise<{ shopId: string }>` (sign up fresh, onboard via API, submit, approve with an admin in its own `newClientContext`, close it).

- [ ] **Step 2: Run** `bun run test:e2e -- tests/e2e/desk.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement shell, components, restyled pages.**
- [ ] **Step 4: Run** `bun run test:e2e` (full) — Expected: desk spec + `merchant-onboarding`, `merchant-api`, `admin-merchants` all pass.
- [ ] **Step 5: Commit** `feat(merchant): Gillu desk shell and Phase 2 pages in the desk design`

---

### Task 4: Catalog domain rules

**Files:**
- Create: `src/lib/slug.ts` (move `suggestSlug` from `src/modules/merchants/domain/slug.ts`; merchants file re-exports it)
- Create: `src/modules/catalog/domain/{money,sku,product-status,publishability}.ts`
- Test: `tests/unit/catalog/{money,sku,product-status,publishability}.test.ts`

**Interfaces:**
- Produces:
  - `parseRupees(input: string): number | null` — paise or null; `formatPaise(paise: number): string` → `"₹1,299.50"` / `"₹399"` (en-IN grouping, decimals only when non-zero).
  - `normalizeSku(input: string): string | null` — trim, uppercase, `^[A-Z0-9_-]{1,40}$`.
  - `PRODUCT_STATUSES`, `type ProductStatus`, `canTransitionProduct(from, to): boolean`, `productStatusesAllowedBefore(to): ProductStatus[]`, `assertProductTransition(from, to)` (throws `ConflictError("invalid_transition", …)`).
  - `type PublishBlocker = "category" | "variant" | "image"`; `publishBlockers(p: { categoryActive: boolean | null; activePricedVariants: number; images: number }): PublishBlocker[]`.
  - `LOW_STOCK_THRESHOLD = 5`; `STOCK_REASONS = ["INITIAL","RESTOCK","DAMAGED","CORRECTION","OTHER"] as const`; `MAX_PRODUCT_IMAGES = 8`; `MAX_IMAGE_BYTES = 4 * 1024 * 1024`.

- [ ] **Step 1: Write the failing tests**

```ts
// money.test.ts
test.each([["399", 39900], ["1299.5", 129950], ["₹1,299", 129900], [" 1299 ", 129900], ["0.01", 1], ["1,00,000", 10000000]])(
  "parses %j", (input, paise) => expect(parseRupees(input)).toBe(paise));
test.each(["", "0", "-5", "1299.505", "abc", "1e3", "12.3.4"])("rejects %j", (input) => expect(parseRupees(input)).toBeNull());
test("formats", () => { expect(formatPaise(129950)).toBe("₹1,299.50"); expect(formatPaise(39900)).toBe("₹399"); expect(formatPaise(10000000)).toBe("₹1,00,000"); });
// sku.test.ts
test("normalizes", () => expect(normalizeSku(" kk-kaju_500 ")).toBe("KK-KAJU_500"));
test.each(["", "has space", "x".repeat(41), "émoji"])("rejects %j", (s) => expect(normalizeSku(s)).toBeNull());
// product-status.test.ts — allowed: DRAFT→PUBLISHED, PUBLISHED→UNPUBLISHED, UNPUBLISHED→PUBLISHED,
// DRAFT|PUBLISHED|UNPUBLISHED→ARCHIVED; everything else (incl. ARCHIVED→*, *→DRAFT, *→PENDING_APPROVAL) refused.
// publishability.test.ts
expect(publishBlockers({ categoryActive: true, activePricedVariants: 1, images: 1 })).toEqual([]);
expect(publishBlockers({ categoryActive: false, activePricedVariants: 0, images: 0 })).toEqual(["category", "variant", "image"]);
expect(publishBlockers({ categoryActive: null, activePricedVariants: 1, images: 1 })).toEqual(["category"]);
```

- [ ] **Step 2: Run** `bun run test:unit -- tests/unit/catalog` — Expected: FAIL (modules missing).
- [ ] **Step 3: Implement.** `parseRupees`: strip `₹`, commas, surrounding spaces; must match `^\d+(\.\d{1,2})?$`; > 0; ≤ 1,00,00,000 rupees; compute with integer string math (no float multiply).
- [ ] **Step 4: Run** unit tests — Expected: PASS (merchants slug tests still pass).
- [ ] **Step 5: Commit** `feat(catalog): money, SKU, product status and publish rules`

---

### Task 5: Catalog schema and migrations 0003/0004

**Files:**
- Create: `src/db/schema/catalog/{tables,relations}.ts` (relative imports, timestamptz); export from `src/db/schema/index.ts`
- Generate: `bun run db:generate` → `drizzle/0003_*.sql` (review: no DROP/ALTER of existing tables)
- Create: `bunx drizzle-kit generate --custom --name seed_categories` → `drizzle/0004_seed_categories.sql` with 7 `INSERT … ON CONFLICT (slug) DO NOTHING` rows, ids `cat_<slug_with_underscores>`, `sort_order` 10, 20, … 70
- Test: `tests/integration/db/migrations.test.ts` (extend)

**Interfaces:**
- Produces tables (spec §5.1) as drizzle objects `categoriesTable`, `productsTable`, `productVariantsTable`, `productImagesTable`, `inventoryTable`, `inventoryMovementsTable`; enums `product_status`, `inventory_movement_reason`.
- Decided here: `product_variants.merchant_id` (denormalised, FK merchants restrict) with unique `product_variants_merchant_sku_unique (merchant_id, sku)`; `products_merchant_slug_unique (merchant_id, slug)`; `categories_slug_unique`, `categories_name_unique`; CHECKs `product_variants_price_positive`, `product_variants_mrp_gte_price` (`declared_mrp_paise IS NULL OR declared_mrp_paise >= price_paise`), dims/weight > 0, `inventory_available_nonnegative`, `inventory_reserved_nonnegative`, `inventory_movements_delta_nonzero`, `products_currency_inr`; index `products_merchant_status_idx`; product admin-hold columns `admin_hold_reason`, `admin_hold_by` (FK user set null), `admin_hold_at`.

- [ ] **Step 1: Write the failing test**

```ts
test("catalog tables exist and categories are seeded", async () => {
  for (const t of ["categories","products","product_variants","product_images","inventory","inventory_movements"]) {
    expect(await tableExists(db, t)).toBe(true);
  }
  const rows = await db.select({ name: categoriesTable.name }).from(categoriesTable).orderBy(categoriesTable.sortOrder);
  expect(rows.map((r) => r.name)).toEqual(["Regional packaged food","Snacks and sweets","Cashews and dry fruits","Art and handicrafts","Home and festive decor","Handmade gifts","Other regional products"]);
});
test("the database refuses negative stock and MRP below price", async () => { /* raw inserts → rejects with the CHECK names above */ });
```
- [ ] **Step 2: Run** `bun run test:integration -- tests/integration/db` — Expected: FAIL.
- [ ] **Step 3: Write schema, generate both migrations, inspect SQL.**
- [ ] **Step 4: Run** integration tests — Expected: PASS; re-running migrations is a no-op (existing test).
- [ ] **Step 5: Commit** `feat(db): catalog tables (migration 0003) and seeded categories (0004)`

---

### Task 6: Categories (service, APIs, admin page)

**Files:**
- Create: `src/modules/catalog/application/categories.ts`, `src/modules/catalog/presentation/schemas.ts` (category schemas), `src/modules/catalog/index.ts` (server-only)
- Create: `src/app/api/v1/categories/route.ts`, `src/app/api/v1/admin/categories/route.ts`, `src/app/api/v1/admin/categories/[id]/route.ts`
- Create: `src/app/(starter)/admin/categories/{page.tsx,page.client.tsx}`; admin nav link "Categories" in `src/app/(starter)/admin/layout.tsx`
- Test: `tests/integration/catalog/categories.test.ts`, `tests/integration/support/catalog.ts`

**Interfaces:**
- Produces: `type Category = { id; name; slug; sortOrder; isActive }`; `listActiveCategories(db): Promise<Category[]>`; `listCategories(db, admin: AdminActor)`; `createCategory(db, admin, { name, sortOrder? })` (slug via `suggestSlug`; `409 category_exists`); `updateCategory(db, admin, id, { name?, sortOrder?, isActive? })` (`404`; `409 category_exists`). Schemas `categoryCreateSchema` (name trimmed 2–60), `categoryPatchSchema` (partial, non-empty).
- Support: `seedApprovedMerchant(db, overrides?) → MerchantContext`, `seedCategory(db, name?)`.

- [ ] **Step 1: Failing integration tests:** lists seeded active categories in sort order; create adds one with slug; duplicate name (case-insensitive) → `category_exists`; deactivate hides it from `listActiveCategories` but not from admin list; unknown id → `NotFoundError`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement service, routes (`GET /api/v1/categories` public; admin routes `authorizeAdmin()`), admin page (`requireAdmin()` in the page; table with name, slug, order, active toggle; add form; rename inline).**
- [ ] **Step 4: Run** integration — Expected: PASS. E2E assertion added to `tests/e2e/admin-catalog.spec.ts`: admin adds "Pickles and preserves" and sees it; non-admin `/admin/categories` → 404; `GET /api/v1/admin/categories` as non-admin → 403.
- [ ] **Step 5: Commit** `feat(catalog): admin-managed categories`

---

### Task 7: Products, variants and inventory services

**Files:**
- Create: `src/modules/catalog/application/{products,variants,inventory}.ts`; extend `presentation/schemas.ts`, `index.ts`
- Test: `tests/integration/catalog/{products,inventory}.test.ts`, `tests/unit/catalog/schemas.test.ts`

**Interfaces:**
- Consumes: `MerchantContext` (merchants), `parseRupees`, `normalizeSku`, `suggestSlug`, `STOCK_REASONS`, `LOW_STOCK_THRESHOLD`.
- Produces:
  - Schemas: `variantFieldsSchema` (`label?` 1–40, `sku`, `price` rupee string → paise, `mrp?` → paise|undefined, `weightGrams` int 1–50000, `lengthMm`/`widthMm`/`heightMm` int 1–2000; refine `mrp >= price` with error on `mrp`: "Price cannot be higher than the declared MRP."), `productCreateSchema` (`name` 2–120, `categoryId`, `description?` ≤ 5000, `variant: variantFieldsSchema`, `initialStock` int 0–100000), `productPatchSchema` (`name?`, `categoryId?`, `description?`, `slug?` — slug only while DRAFT), `variantCreateSchema` (`variantFieldsSchema` + `initialStock`, `label` required), `variantPatchSchema` (partial + `isActive?`), `stockAdjustmentSchema` (`delta` int ≠ 0, |delta| ≤ 100000, `reason` ∈ `STOCK_REASONS` except INITIAL, `note?` ≤ 200).
  - Types: `ProductImageView { id, url, alt, sortOrder, width, height }` (defined here, filled by Task 8), `ProductSummary { id, name, slug, status, categoryName, priceFromPaise | null, totalAvailable, lowStock: boolean, coverImageUrl | null, adminHoldReason | null }`, `ProductDetail` (+ `description`, `categoryId`, `variants: VariantView[]`, `images: ProductImageView[]`, `publishBlockers: PublishBlocker[]`), `VariantView { id, label, sku, pricePaise, declaredMrpPaise, weightGrams, lengthMm, widthMm, heightMm, isActive, available, reserved }`, `StockMovementView { id, delta, reason, note, availableAfter, createdAt, actorName | null }`.
  - `createProduct(db, ctx, input) → ProductDetail` (one transaction: product DRAFT + default variant `label null` + inventory row + INITIAL movement when `initialStock > 0`; category must be active → else `ValidationError` on `categoryId`).
  - `listProducts(db, ctx, { q?, status? }) → ProductSummary[]` (archived only when `status = ARCHIVED`), `getProduct(db, ctx, id) → ProductDetail` (`NotFoundError("Product not found.")` for other shops).
  - `updateProduct(db, ctx, id, patch)` (ARCHIVED → `409 archived`; slug change on non-DRAFT → `409 slug_locked`; slug taken → `409 slug_taken`).
  - `addVariant(db, ctx, productId, input)` (once a product has ≥ 2 variants every active variant needs a label → `409 label_required`), `updateVariant(db, ctx, variantId, patch)` (deactivating the last active variant of a PUBLISHED product → `409 last_variant`).
  - `adjustStock(db, ctx, variantId, { delta, reason, note }) → VariantView` (guarded UPDATE per spec §5.2 + movement row with `availableAfter`, one transaction; 0 rows → `409 insufficient_stock` "Not enough stock for that change."), `listStockMovements(db, ctx, variantId, limit = 20)`.
  - SKU unique violation → `409 sku_taken` (field `sku`).
  - `catalogCounts(db, ctx) → { byStatus: Record<ProductStatus, number>, outOfStock: number, lowStock: number }` (for the overview, Task 11).

- [ ] **Step 1: Failing tests.** Unit (`schemas.test.ts`): `variantFieldsSchema` turns price `"₹1,299"` into 129900 and blank MRP into `undefined`; MRP `"1000"` with price `"1500"` fails on `mrp` with "Price cannot be higher than the declared MRP."; price `"0"` fails on `price`; SKU `"bad sku"` fails on `sku`. Integration (names are the assertions):
  - "creating a product makes a draft, a default variant, inventory and an INITIAL movement atomically"
  - "a bad category leaves nothing behind"
  - "the same SKU is fine in two shops but taken within one" (`sku_taken`)
  - "another shop's product, variant and movements are 404 and unchanged"
  - "a second variant requires labels"
  - "the last active variant of a published product cannot be deactivated" (`last_variant`; seed status PUBLISHED directly)
  - "stock cannot go below zero" (`insufficient_stock`, row unchanged)
  - "twenty concurrent −1 adjustments on stock 10 leave 0 and exactly 10 movements" (`Promise.allSettled`; 10 fulfilled, 10 `insufficient_stock`)
  - "archived products cannot be edited"; "slug is locked after draft"
  - "catalogCounts counts by status, out of stock and low stock (≤ 5)"
- [ ] **Step 2: Run** `bun run test:integration -- tests/integration/catalog` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(catalog): products, variants and stock adjustments`

---

### Task 8: Product images and image storage

**Files:**
- Create: `src/modules/catalog/application/{image-storage,images}.ts`, `src/modules/catalog/infrastructure/{image-type,local-image-storage,uploadthing-image-storage}.ts`
- Modify: `src/platform/env.ts` — add `IMAGE_STORAGE_DRIVER` (`"local" | "uploadthing"`, default `"uploadthing"`), `IMAGE_STORAGE_LOCAL_DIR` (default `.data/images`), `IMAGE_STORAGE_ALLOW_LOCAL_IN_PRODUCTION` (`"true"` only); `.env.example`, `.env.docker.example` documented; `.gitignore` adds `.data/`
- Modify: `scripts/e2e.ts` env — `IMAGE_STORAGE_DRIVER=local`, `IMAGE_STORAGE_ALLOW_LOCAL_IN_PRODUCTION=true`, a temp `IMAGE_STORAGE_LOCAL_DIR`
- Create: `src/app/api/v1/images/[...key]/route.ts` (local driver only: serves the file with stored content type, `Cache-Control: public, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff`; rejects `..`/absolute keys → 404; 404 when driver is not local)
- Add dependency: `image-size` (check API with ctx7)
- Test: `tests/unit/catalog/image-type.test.ts`, `tests/integration/catalog/images.test.ts`

**Interfaces:**
- Produces:
  - `interface ImageStorage { put(file: { bytes: Uint8Array; contentType: ImageContentType; name: string }): Promise<{ key: string; url: string }>; delete(key: string): Promise<void> }`; `getImageStorage(): ImageStorage` (throws `AppError("image_storage_unavailable", "Image uploads are not configured.", 503)` when driver is uploadthing without `UPLOADTHING_TOKEN`, or local in production without the allow flag).
  - `detectImageType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null` (magic bytes: `FF D8 FF`; `89 50 4E 47 0D 0A 1A 0A`; `RIFF????WEBP`).
  - `addProductImage(db, storage, ctx, productId, { bytes, name, alt? }) → ProductImageView` (`400 invalid_image` "Upload a JPEG, PNG or WebP image.", `400 image_too_large` "Images must be 4 MB or smaller.", `409 image_limit` "A product can have up to 8 images."; stores width/height via `image-size`; storage write happens before the DB insert and is deleted again if the insert fails), `updateProductImage(db, ctx, imageId, { alt?, sortOrder? })`, `deleteProductImage(db, storage, ctx, imageId)` (uses `ProductImageView` from Task 7).
  - Local keys: `<merchantId>/<cuid2>.<ext>`; URL `/api/v1/images/<key>`. UploadThing adapter: `new UTApi({ token }).uploadFiles(new File([...]))` → `{ key, url: ufsUrl }`, `deleteFiles(key)` — verify names with ctx7.

- [ ] **Step 1: Failing tests**
  - Unit: detects JPEG/PNG/WebP from real 1×1 fixture bytes (commit tiny fixtures under `tests/fixtures/images/`); returns null for `<!doctype html>`, an SVG, a GIF (`GIF89a`), empty bytes.
  - Integration (local adapter on a tmp dir): "uploads a WebP and records size and dimensions"; "an HTML file named .jpg is refused and nothing is stored" (dir empty, no row); "4 MB + 1 byte is refused"; "the ninth image is refused"; "deleting removes the row and the file"; "another shop's image is 404"; "storage is unavailable without an UploadThing token" (`getImageStorage` with driver uploadthing and no token → 503 code).
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** unit + integration — Expected: PASS.
- [ ] **Step 5: Commit** `feat(catalog): product images with local and UploadThing storage`

---

### Task 9: Product status, admin hold and purchasable products

**Files:**
- Create: `src/modules/catalog/application/{status,admin,purchasable}.ts`
- Test: `tests/integration/catalog/{status,purchasable}.test.ts`

**Interfaces:**
- Produces:
  - `publishProduct(db, ctx, id)`, `unpublishProduct(db, ctx, id)`, `archiveProduct(db, ctx, id)` → `ProductDetail`. Publish: shop must be APPROVED (re-read), no admin hold (`409 admin_hold`), `publishBlockers` empty (`409 not_publishable` "Add what is missing before publishing." with `details: { missing: PublishBlocker[] }`); sets `published_at`. All three are guarded UPDATEs (`WHERE status IN productStatusesAllowedBefore(to)`); 0 rows → load → `assertProductTransition` / `409 invalid_transition`.
  - `listProductsForAdmin(db, admin, { status? }) → (ProductSummary & { merchantId; storeName })[]`; `holdProduct(db, admin, id, { reason })` (route name `unpublish`, spec §5.4) (PUBLISHED → UNPUBLISHED, sets hold columns; `holdSchema` reason 5–500); `releaseProduct(db, admin, id)` (clears hold, status unchanged; no hold → `409 no_hold`).
  - `listPurchasableProducts(db, { categorySlug?, merchantId?, limit = 24 }) → PurchasableProduct[]` where `PurchasableProduct { productId, slug, name, merchantSlug, storeName, categorySlug, priceFromPaise, coverImageUrl }` — only PUBLISHED, merchant APPROVED, category active, no hold, ≥ 1 active variant with `available > 0` (price-from over in-stock active variants).

- [ ] **Step 1: Failing integration tests:**
  - "publishing needs a category, a priced variant and an image" (`details.missing` exact list)
  - "publish, unpublish, republish, archive"; "archived is final"
  - "publish and archive at once: one wins" (`Promise.allSettled`)
  - "a draft shop cannot publish" (seed merchant SUBMITTED)
  - "an admin hold unpublishes, blocks republish, shows the reason, and release leaves it unpublished"
  - "purchasable excludes draft, unpublished, archived, held, out-of-stock, inactive-variant, inactive-category and suspended-shop products" (one fixture per case + one good product; result is exactly the good one)
  - "deactivating the category of a published product removes it from purchasable and blocks republish"
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(catalog): publish lifecycle, admin hold and purchasable query`

---

### Task 10: Catalog API routes

**Files:**
- Modify: `src/modules/merchants/index.ts` — add `authorizeApprovedMerchant(): Promise<MerchantContext>` (401 / 403 "You do not have a shop yet." / 403 `ForbiddenError("Your shop must be approved to manage products.")`)
- Create routes (all `apiRoute`, `RouteContext<…>`, `await context.params`):
  - `src/app/api/v1/merchant/products/route.ts` GET (`?q`, `?status` validated → 400) / POST 201
  - `…/merchant/products/[id]/route.ts` GET / PATCH
  - `…/merchant/products/[id]/{publish,unpublish,archive}/route.ts` POST
  - `…/merchant/products/[id]/variants/route.ts` POST 201; `…/variants/[variantId]/route.ts` PATCH
  - `…/merchant/products/[id]/images/route.ts` POST 201 (multipart field `file`, optional `alt`; `request.formData()`; non-multipart → 400 `validation_failed`); `…/images/[imageId]/route.ts` PATCH / DELETE (204 → use `ok(null)` 200 for contract consistency)
  - `…/merchant/variants/[variantId]/stock-adjustments/route.ts` POST; `…/stock-movements/route.ts` GET
  - `…/admin/products/route.ts` GET (`?status`); `…/admin/products/[id]/{unpublish,release}/route.ts` POST (`unpublish` body `{ reason }` → `holdProduct`)
- Test: `tests/e2e/catalog-api.spec.ts`

**Interfaces:**
- Consumes: everything produced in Tasks 6–9.
- Produces: HTTP contract documented in Task 13.

- [ ] **Step 1: Failing E2E (API over HTTP):**
  - signed out → 401 on `GET /api/v1/merchant/products`; draft shop → 403
  - approved merchant: create (price `"₹1,299"` → `priceFromPaise 129900`), add labelled variants, upload a fixture PNG, adjust stock (+5, then −999 → 409 `insufficient_stock`), publish → 200 `PUBLISHED`
  - publish without image → 409 `not_publishable` with `details.missing` `["image"]`
  - another approved merchant: GET/PATCH that product, POST stock adjustment on its variant, DELETE its image → all 404; original unchanged
  - non-admin `POST /api/v1/admin/products/{id}/unpublish` → 403; admin hold with reason → merchant publish → 409 `admin_hold`
  - suspended shop's member → 403 on catalog routes
  - text file uploaded as `image/jpeg` → 400 `invalid_image`
- [ ] **Step 2: Run** `bun run test:e2e -- tests/e2e/catalog-api.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement routes.**
- [ ] **Step 4: Run** full `bun run test:e2e` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): merchant catalog, stock, image and admin product endpoints`

---

### Task 11: Merchant product pages and real overview

**Files:**
- Create: `src/app/merchant/products/page.tsx` (+ `page.client.tsx` for toolbar), `src/app/merchant/products/new/{page.tsx,page.client.tsx}`, `src/app/merchant/products/[id]/{page.tsx,page.client.tsx}`; components `src/ui/gillu/desk/{product-card,product-form.client,variants-table.client,stock-dialog.client,images-panel.client,status-actions.client}.tsx`
- Modify: `src/app/merchant/dashboard/page.tsx` — overview welcome panel + metric cards from `catalogCounts` (Products published / drafts / out of stock / low stock), shop status badge "Approved", `/shops/<slug>`, primary pickup; keep existing E2E copy
- Test: `tests/e2e/merchant-products.spec.ts`

**Interfaces:**
- Consumes: `requireApprovedMerchant(nextPath)`, `listProducts`, `getProduct`, `listActiveCategories`, `catalogCounts`, `formatPaise`, API routes from Task 10 (client mutations via `sendJson` from `~/lib/api-client`; image upload via `fetch` with `FormData`).

Copy (spec §4.5): list heading "The things you make." / "A small collection, with a story in every detail."; action "Add a product"; empty state "Nothing in this collection yet." / "Add your first product to start building your collection."; no-results "No products match your search."; new page heading "Add to your collection."; edit page heading "A little product polish."; buttons "Save draft", "Save changes", "Publish", "Unpublish", "Archive" (Archive asks for confirmation in a `Modal`: "Archived products cannot be restored."), "Adjust stock", "Add variant", "Upload image"; blockers list heading "Before you can publish:" with items "Choose an active category", "Add a variant with a price", "Add at least one image"; hold notice "Gillu has paused this product: <reason>". Field ids: `#name`, `#categoryId`, `#description`, `#price`, `#mrp`, `#sku`, `#weightGrams`, `#lengthMm`, `#widthMm`, `#heightMm`, `#initialStock`. Price/MRP labels per Global Constraints. Field errors from `fieldErrors()` shown under each field.

- [ ] **Step 1: Failing E2E:**
  - "an approved merchant creates, stocks, illustrates and publishes a product" — empty state visible → Add a product → fill (category "Snacks and sweets", price `1,299`, MRP `1499`, SKU `kk-kaju-500`, weight 520, dims 220×160×60, stock 12) → Save draft → lands on edit page with "DRAFT" badge and blockers listing "Add at least one image" → upload `tests/fixtures/images/pixel.png` → blockers gone → Publish → "PUBLISHED" → back to list: card shows "₹1,299", "12 in stock"
  - "variants and stock" — Add variant "250 g" (price 699, stock 3) → card/overview show low stock; Adjust stock −5 on it → error "Not enough stock" shown, value still 3
  - "MRP below price shows a field error" — price 1500, MRP 1000 → "Price cannot be higher than the declared MRP." under `#mrp`
  - "overview counts real products" — after publishing one and leaving one draft: overview shows 1 published, 1 draft
  - "archive asks first and is final" — Archive → confirm → status "ARCHIVED", no Publish/Unpublish buttons
  - "a draft shop is redirected from products" — `/merchant/products` → `/merchant/onboarding`
- [ ] **Step 2: Run** `bun run test:e2e -- tests/e2e/merchant-products.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement pages and components in desk styles (`catalog-toolbar`, `catalog-grid`, `product-card`, `panel`, `form-grid`, `field`, `badge`).**
- [ ] **Step 4: Run** full `bun run test:e2e` — Expected: PASS. Screenshot `/merchant/products` (with two products) next to the source desk Products screen at 1366 and 360 px; note differences in the ledger.
- [ ] **Step 5: Commit** `feat(merchant): product catalog pages and real overview in the Gillu desk`

---

### Task 12: Admin product moderation page

**Files:**
- Create: `src/app/(starter)/admin/products/{page.tsx,page.client.tsx}`; admin nav link "Products"
- Test: `tests/e2e/admin-catalog.spec.ts` (extend from Task 6)

**Interfaces:**
- Consumes: `listProductsForAdmin`, `holdProduct`/`releaseProduct` via `/api/v1/admin/products/**`.

Page: `requireAdmin()` in the page; status tabs like `/admin/merchants`; table (product, shop, status, price from, hold reason); PUBLISHED rows: "Pause product" with reason textarea `#hold-reason`; held rows: "Release". Admin look (existing primitives).

- [ ] **Step 1: Failing E2E:** admin pauses a published product with "Please add an ingredients list" → merchant edit page shows "Gillu has paused this product: Please add an ingredients list" and no Publish button works (409 message shown) → admin releases → merchant publishes again. Non-admin: `/admin/products` → 404, HTML and forged RSC (`forgedAdminRscHeaders()`, assert `text/x-component`) do not contain the product name.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** full `bun run test:e2e` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(admin): product moderation with hold and release`

---

### Task 13: Docs, tracker, gate, Compose smoke

**Files:**
- Modify: `docs/architecture.md` (route groups, Gillu UI layer, catalog module, image storage), `docs/database-design.md` (0003/0004 tables), `docs/api-contracts.md` (all Phase 3 endpoints + codes: `category_exists`, `sku_taken`, `slug_taken`, `slug_locked`, `archived`, `label_required`, `last_variant`, `insufficient_stock`, `invalid_image`, `image_too_large`, `image_limit`, `image_storage_unavailable`, `not_publishable`, `admin_hold`, `no_hold`, `invalid_transition`), `docs/merchant-workflow.md` (products section), `docs/testing.md` (new suites), `docs/deployment.md` (image storage env; Compose default uploadthing → uploads 503 until token), `README.md` (env vars), `diagrams/decisions.md`, `diagrams/implementation-progress.md`
- New ADRs (Accepted): **ADR-026** Gillu UI port: keep source CSS scoped with `@scope`, starter routes in `(starter)` group; **ADR-027** Variants own price/MRP/SKU/weight/dims/stock; **ADR-028** Direct publish for approved shops + admin hold; **ADR-029** Image storage driver (local for dev/E2E, UploadThing for production; local in production only with explicit flag); **ADR-030** Inventory changes only through guarded adjustments with movement log.
- Tracker: Phase 3 COMPLETED **only after Step 2**; UploadThing "code complete; manual verification NEEDS_INPUT (token)"; Phase 4 note: landing previews still illustrative; `listPurchasableProducts` ready.

- [ ] **Step 1: Update docs and ADRs.**
- [ ] **Step 2: Gate** — `bun run typecheck && bun run lint && bun run knip && bun run test:unit && bun run test:integration && bun run test:e2e` — Expected: all exit 0. Compose smoke as project `gillu-smoke` with the Phase 2 override (renamed containers, port 18080, throwaway env in a fresh temp dir): migrate exits 0; `drizzle.__drizzle_migrations` has 5 rows; 7 categories; `GET /` → 200 containing "gillu"; `GET /api/v1/categories` → 200 with 7 items; `GET /api/v1/merchant/products` → 401 JSON with `requestId`; then `down -v` for `gillu-smoke` only; confirm `gillu_*` and `relivator_postgres_data` volumes still exist.
- [ ] **Step 3: Append the Phase 3 report** (§29 template) with real numbers.
- [ ] **Step 4: Commit** `docs: Phase 3 catalog and Gillu UI report`
