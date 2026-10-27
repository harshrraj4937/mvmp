# Gillu Phase 3 — Catalog + Gillu UI Port — Design

Status: DRAFT for approval (builder check done) · 2026-10-27 · branch `gillu/phase-3` (from `gillu/phase-2`)
Parent spec: [2026-10-27-gillu-marketplace-design.md](2026-10-27-gillu-marketplace-design.md)
Requirements: `diagrams/implementation-prompt.txt` §9 (product management), Phase 3 checklist, §29 completion rule.
UI source: `/opt/NH/gillu` (static HTML/CSS/JS, the user's product design).

## 1. Intent

Two things in one round, because the user wants the real Gillu look before
more screens are built in the starter's look:

1. **Port the Gillu design** from `/opt/NH/gillu` into the Next.js app as
   TypeScript components: the festive landing page becomes `/`, and the
   merchant "desk" (sidebar workspace) becomes the shell for every
   `/merchant/*` page.
2. **Build Phase 3 for real**: categories, products with variants, images,
   status, inventory and stock adjustments, and the merchant product UI in
   the desk design. Deliverable (requirements): *an approved merchant can
   publish real products.*

## 2. Goals, non-goals, anti-goals

Goals
- The landing page and desk look like `/opt/NH/gillu` (same CSS, fonts,
  images, copy, SVG icons, responsive behaviour, keyboard behaviour).
- Every number and list in the desk comes from the database.
- Merchants (owner and staff) of an APPROVED shop manage products end to end.

Non-goals (this round)
- Customer storefront wired to the database, product detail pages, cart,
  shop pages (Phase 4). The demo shop page `shop.html` is **not** ported.
- Orders, courier/payment simulator, reviews, notifications (Phases 5–8).
- Restyling auth pages and admin pages (they keep the current look; new
  admin pages use the current admin look).

Anti-goals (failure even if it "works")
- Any fake data in the app: no seed orders, sample products, demo
  merchants, "Play order journey", simulator, "DEMO MODE" badge, or
  localStorage-backed state. Screens without a backend are **hidden**, not
  faked.
- Claiming UploadThing uploads work without having run them with real
  credentials.
- Breaking Phase 2 flows or their E2E tests.

## 3. Decisions made with the user

| Topic | Decision |
|---|---|
| Scope | Design port + real Phase 3 |
| CSS | Keep Gillu's CSS files (scoped), convert markup and JS to TSX |
| Product approval | **Direct publish.** APPROVED merchant: DRAFT → PUBLISHED instantly. `PENDING_APPROVAL` exists in the enum, unused. Admin can unpublish any product |
| Categories | **Admin-managed** list at `/admin/categories`, seeded with the seven categories from the landing page's seller form |
| Landing version | **Commit `eacfe57`** of `/opt/NH/gillu` (pre-demo). The current checkout `2766b1f` reworked the page around the fake demo shop (announcement "Our demo store is open", hero "Shop the demo store" → `shop.html`, seller section removed); it is **not** the baseline. Read the files with `git -C /opt/NH/gillu show eacfe57:<path>`. The desk comes from `gillu-merchant-html/` (only in `2766b1f`) |
| Variants | **Yes, now.** Every product has ≥ 1 variant; price, declared MRP, SKU, weight, dimensions and stock live on the variant. Single-option products have one default variant the UI does not show as a choice |

## 4. UI port

### 4.1 Source → target

| Source | Target |
|---|---|
| `index.html` + `styles.css` + `app.js` **at `eacfe57`** | `/` (route group `(site)`): server components for static sections; small client components for interactive parts |
| `gillu-merchant-html/index.html` shell (sidebar, topbar, footer, dialogs) + `styles.css` | `src/app/merchant/layout.tsx` desk shell |
| Desk Products screen + product modal | `/merchant/products`, `/merchant/products/new`, `/merchant/products/[id]` |
| Desk Overview | `/merchant/dashboard` (real data only, §4.4) |
| Desk Store Profile | `/merchant/profile` (Phase 2 form, restyled) |
| Desk Settings | `/merchant/settings/shipping` (Phase 2 pickup locations, restyled) |
| Onboarding status cards | `/merchant/onboarding` restyled; stays outside the sidebar shell until APPROVED (§4.3) |
| `assets/*.webp`, `favicon.svg` | `public/gillu/` (or static imports with `next/image`) |
| `assets/font-*.ttf` | `next/font/local` (Fraunces, DM Sans), OFL licence files kept alongside |
| `design/originals/*.png` (17 MB) | **not copied** (never loaded by the pages) |
| Inline SVG `<symbol>` library (squirrel, icons) | one `GilluIcons` sprite component + `<Icon name>` |
| `THIRD-PARTY-NOTICES.md` | merged into the repo's notices |

### 4.2 CSS: keep their files, scoped

- Copy `styles.css` (site) and `gillu-merchant-html/styles.css` (desk)
  verbatim except: `@font-face` blocks removed (fonts come from
  `next/font/local` CSS variables), asset `url()`s re-pointed, and **all rules
  wrapped in `@scope (.gillu-site)` / `@scope (.gillu-desk)`**, with `:root`
  tokens moved to `:scope`. Reason: Next keeps global CSS loaded across
  client navigations, and Gillu's element selectors (`body`, `h1`, `button`,
  `dialog`) would otherwise restyle the Tailwind/shadcn pages.
- The site layout renders `<div class="gillu-site">`, the desk layout
  `<div class="gillu-desk">`. Tailwind/shadcn is not used inside those
  trees, except shadcn-free primitives already present (none required).
- Browser floor implied by `@scope`: Chrome/Edge 118+, Safari 17.4+,
  Firefox 128+ (all current). Builder may instead prefix selectors at build
  time if `@scope` causes a real problem; record it as a ruling.
- Desk CSS for removed features (simulator, journey player, demo badge,
  reviews, order drawer) is deleted, not left dormant. Order-table styles are
  kept only if the product table reuses them.

### 4.3 Landing page behaviour

- Baseline is `eacfe57` (hero button "Explore the collection" → `#discover`;
  "Be part of the beginning" opens the early-access dialog; seller section
  present). No "demo store" wording anywhere.
- Ported as-is: header with mobile nav, hero, collection previews with
  filters and the detail `<dialog>`, festival tabs (Diwali/Onam/Pongal,
  arrow-key navigation, source links), region previews, story, values, how
  it works, early-access dialog (still collects nothing), footer.
- Collection previews stay **illustrative marketing content** (they have no
  prices and say pre-launch); Phase 4 replaces them with published products.
- **Seller section and seller dialog change:** onboarding is real now, so
  "Seller applications open soon" + "download a business profile draft" is
  replaced by a "Start selling" link to `/merchant/onboarding` (the seller
  section's button links there directly; the seller dialog and the download
  tool are dropped). Header/footer "Sell on Gillu" links go to `#sell`.
- Any "Shop" link goes to `#discover` until Phase 4.
- Header gains "Sign in" / account link (to existing auth pages).
- The Relivator home page is removed; `/products` and other Relivator mock
  routes stay untouched until Phase 4 and are not linked from the new header.
- Metadata: title, description, theme colour `#73392e`, favicon, OG image
  from `hero.webp`.

### 4.4 Desk shell behaviour

- Sidebar: **Overview** (`/merchant/dashboard`), **Products**, **Store
  profile**, **Shipping** (pickup locations). Orders and Reviews are **not
  shown** until their phases exist. Mobile menu button and skip link kept.
- Topbar: breadcrumb with the current page; product search box (submits to
  `/merchant/products?q=`); store initials button → profile. No
  notification bell, no "DEMO MODE".
- The shell is a layout (UX only). Every page still calls
  `requireMerchant` / `requireApprovedMerchant` itself (Phase 1–2 rule).
- Shops that are not APPROVED see onboarding/status pages in a minimal desk
  frame without the product nav item.
- Full source-to-target map for the merchant dashboard: §4.5.
- Overview (real data only): greeting with owner first name and shop name,
  shop status badge, shop URL, counts of products by status, variants out of
  stock and low stock (available ≤ 5), primary pickup location, links. No
  order or revenue figures.
- All Phase 2 element ids and visible copy that E2E relies on are preserved
  (e.g. `#storeName`, "Your shop is a draft", "Profile saved").

### 4.5 Merchant dashboard source: `/opt/NH/gillu/gillu-merchant-html/`

The merchant dashboard (every `/merchant/*` page, this phase and later
ones) is converted from `gillu-merchant-html/` (current checkout `2766b1f`).
It is the single design source for merchant screens; no screen is designed
from scratch or in the starter's shadcn look. Nothing in it is dropped
silently — each part is ported now, assigned to the phase whose backend
it needs, or dropped for a stated reason:

| Source part | Fate |
|---|---|
| `index.html` shell: sidebar + brand, `navigation`, topbar (breadcrumb, global search, `/` shortcut, store initials button), skip link, `workspace-footer`, `modal` dialog | **Ported now** → desk layout + `Modal` component |
| SVG sprite (29 symbols: squirrel, grid, bag, box, star, store, settings, search, bell, chevron, down, arrow, download, plus, truck, check, check-circle, clock, alert, play, pause, reset, filter, close, menu, help, leaf, edit, mail) | **Ported now** as `<DeskIcons>` + `<Icon name>`; unused symbols kept (later phases use them) |
| `styles.css` | **Ported now**, scoped `@scope (.gillu-desk)`; rules for screens assigned to later phases stay in the file until those phases (they are inert without their markup) — only demo-only rules (demo badge, simulator, journey player) are removed |
| `renderOverview` / `renderMetrics` / `renderLower` | **Now** → `/merchant/dashboard`: welcome panel (hero image, "A good day starts here.", owner first name, shop name) + metric cards fed by real product/stock counts. Order metrics/cards arrive in Phase 5 |
| `renderProducts` / `renderCatalog` + product modal (`editProduct`) | **Now** → `/merchant/products` grid, toolbar (search, status filter), empty state; modal replaced by `/new` and `/[id]` pages in the same panel/form styles, with variants, stock and images added |
| `renderProfile` | **Now** → `/merchant/profile`: store card (cover image, initials avatar, name, description, city pill) + "Store details" panel holding the Phase 2 profile form |
| `renderSettings` | **Now** → `/merchant/settings/shipping` uses its `settings-layout` / `panel settings-group` styles for pickup locations. Workspace preferences (notifications, compact rows, reduced motion) are browser-only demo toggles → **dropped** (OS reduced-motion is honoured via CSS) |
| Loading / empty-store / no-results / error-retry states | **Now**, as Next `loading.tsx` / `error.tsx` and empty states in the desk style |
| `renderOrders`, `renderOrderTabs`, `renderOrderResults`, `openFilters`, `openOrder`, `renderDrawer`, `renderDetails`, `renderTimeline`, CSV export, package dims/notes, cancel-with-reason | **Phase 5** (orders) — same markup/styles, real data |
| `renderShipment`, label download, courier states | **Phase 7** (Shiprocket) |
| Payment states (prepaid confirm/refund, COD remittance pending/remitted) | **Phases 6–7** |
| `renderReviews` + replies | **Phase 8** |
| `engine.js` (order/shipping/payment status sets, allowed transitions, `nextStep`, metrics) and `tests/order-engine.test.cjs` | **Reference** for the Phase 5/7 domain models and their tests; not copied as runtime code (the real state machines live in modules with DB-guarded transitions) |
| `renderJourney` ("Play order journey"), `renderSimulator`, "Add demo order", "Reset demo data", `DEMO MODE` badge, notification bell with demo dot | **Dropped** — demo-only, fake events (anti-goal) |
| `data.js` (2 merchants, 24 orders, 12 products, 6 reviews) | **Dropped** — seed/fake data; product names may inspire test fixtures only |
| `localStorage` persistence, JSON data export in Settings | **Dropped** — server data only |
| `assets/` (webp, fonts, favicon, OFL texts) | Same files as the site's; **shared** single copy under `public/gillu/` + `next/font/local` |
| `README.md`, `docs/PROTOTYPE-NOTES.md`, `docs/VERIFICATION.md`, `THIRD-PARTY-NOTICES.md` | Notices merged into repo notices; docs used as reference for behaviour (keyboard, a11y) checks |
| `vercel.json`, `.gitignore` | **Not needed** (Next app has its own) |

Desk copy is kept where it fits real data (headings such as "The things you
make.", "Your store, your story.", empty state "Nothing in this collection
yet."); copy that mentions demo/sample data is rewritten.

### 4.6 Interactivity conversion rules

- Vanilla DOM code becomes React state in client components; no
  `document.querySelector`, no `innerHTML`, no `localStorage` for data.
- Native `<dialog>` kept (showModal/close via refs), focus return on close.
- Keyboard behaviour from the source is preserved (tabs with arrow keys,
  Escape closes dialogs, `/` focuses desk search).
- Reduced-motion CSS kept.

## 5. Catalog (Phase 3 backend)

New module `src/modules/catalog/{domain,application,presentation,index.ts}`
following the merchants module pattern; inventory functions live in
`catalog` unless the builder finds a clean reason to split an `inventory`
module (ruling).

### 5.1 Tables (migration 0003, additive)

| Table | Columns / rules |
|---|---|
| `categories` | `id`, `name` (unique), `slug` (unique), `sort_order`, `is_active` (default true), timestamps. Seeded in the migration: Regional packaged food, Snacks and sweets, Cashews and dry fruits, Art and handicrafts, Home and festive decor, Handmade gifts, Other regional products |
| `products` | `id`, `merchant_id` → merchants (restrict), `category_id` → categories (restrict), `name`, `slug` (unique per merchant), `description`, `status` enum `product_status` (DRAFT, PENDING_APPROVAL, PUBLISHED, UNPUBLISHED, ARCHIVED; default DRAFT), `currency` (`INR`, CHECK), `published_at`, `admin_hold_reason`, `admin_hold_by` → user (set null), `admin_hold_at` (all nullable), timestamps; index (merchant_id, status) |
| `product_variants` | `id`, `product_id` → products (cascade), `label` (null for the default variant), `sku` (unique per merchant — store `merchant_id` on the variant or enforce via product; builder's call), `price_paise` bigint CHECK > 0, `declared_mrp_paise` bigint nullable CHECK (null or ≥ price), `seller_base_price_paise` nullable (unused, reserved for ADR-018), `weight_grams` int CHECK > 0, `length_mm`/`width_mm`/`height_mm` int CHECK > 0, `sort_order`, `is_active`, timestamps |
| `product_images` | `id`, `product_id` → products (cascade), `storage_key`, `url`, `alt`, `sort_order`, `width`, `height`, `bytes`, `content_type`, timestamps; max 8 per product |
| `inventory` | `variant_id` PK → product_variants (cascade), `available` int CHECK ≥ 0, `reserved` int CHECK ≥ 0 (stays 0 until Phase 5), `updated_at` |
| `inventory_movements` | `id`, `variant_id`, `delta` int ≠ 0, `reason` enum (INITIAL, RESTOCK, DAMAGED, CORRECTION, OTHER), `note`, `available_after`, `actor_user_id` → user (set null), `created_at` |

Requirement §9 lists `price_paise`, `declared_mrp_paise`, `sku`, `weight`,
`dimensions` as product fields; with variants they live on the variant (user
decision). The product API exposes `priceFromPaise` (lowest active variant).

### 5.2 Rules

- **Who:** owner and staff of an **APPROVED** shop manage products. Other
  statuses: pages redirect to onboarding (`requireApprovedMerchant`), API
  `403`. Suspending a shop does not change product rows; Phase 4's
  storefront query must require `merchant.status = APPROVED`.
- **Tenant isolation:** merchant derived from membership (ADR-023); product,
  variant, image ids of another shop → `404`.
- **Status transitions:** DRAFT → PUBLISHED; PUBLISHED ⇄ UNPUBLISHED;
  DRAFT/PUBLISHED/UNPUBLISHED → ARCHIVED; ARCHIVED is terminal for merchants
  (no restore in MVP). Guarded UPDATEs like merchant review (concurrent
  actions: one wins, other `409 invalid_transition`). Admin may unpublish a
  PUBLISHED product with a **hold**: required reason (5–500 chars), stored
  with the admin's id and time (`admin_hold_reason`, `admin_hold_by` → user
  set null, `admin_hold_at`). While held the merchant can still edit and
  archive, sees the reason on the product page, and cannot publish
  (`409 admin_hold`). **Release** clears the hold and leaves the product
  UNPUBLISHED; the merchant republishes it. (Builder-check answer, executor's
  call.)
- **Publish requires:** category set and active, ≥ 1 active variant with a
  price, ≥ 1 image. Failing → `409 not_publishable` with `details.missing`
  (`category`, `variant`, `image`).
- **Editing:** DRAFT, PUBLISHED and UNPUBLISHED products are editable
  (direct-publish model; edits to a published product go live). ARCHIVED is
  read-only.
- **Money input:** rupees with up to 2 decimals in forms → integer paise.
  Selling price must be ≤ declared MRP when MRP is given (Indian Legal
  Metrology: no sale above MRP). Selling price is labelled "Price customers
  pay (including delivery)"; MRP labelled "Declared MRP (as printed on the
  pack, if any)". They are never derived from each other.
- **Stock:** set on variant creation (movement `INITIAL`). Afterwards only
  via adjustments: `UPDATE inventory SET available = available + $d WHERE
  variant_id = $v AND available + $d >= 0` in one transaction with the
  movement row; 0 rows → `409 insufficient_stock`. Concurrent adjustments
  never go negative (integration test).
- **SKU:** trimmed, uppercased, `[A-Z0-9-_]{1,40}`, unique per merchant
  (`409 sku_taken`). **Slug:** generated from name, unique per merchant,
  editable while DRAFT.
- **Default variant:** creating a product creates one variant from the same
  form. Adding a second variant requires labels on all variants. Removing
  variants: deactivate (`is_active = false`), never delete once Phase 5
  orders could reference them; at least one active variant must remain on a
  PUBLISHED product.
- **Only published and available products are purchasable** — Phase 3 ships
  the catalog query `listPurchasableProducts` (PUBLISHED, merchant APPROVED,
  category active, variant active, available > 0) with tests, consumed by
  Phase 4.

### 5.3 Images

- `ImageStorage` port in catalog (ADR-014): `put(file) → {key, url, width,
  height, bytes, contentType}`, `delete(key)`.
- Adapters: **UploadThing** (server-side `UTApi.uploadFiles`) for
  production; **local disk** (writes under a configured directory, served
  by a route) for development and E2E. Driver chosen by env
  (`IMAGE_STORAGE_DRIVER=uploadthing|local`); production config refuses
  `local` unless explicitly allowed for self-hosted Compose (builder: decide
  and record).
- Upload: `POST /api/v1/merchant/products/{id}/images` (multipart), JPEG/PNG/
  WebP only (checked by magic bytes, not just extension), ≤ 4 MB, ≤ 8 per
  product. Reorder, set alt text, delete.
- **UploadThing is not configured in `.env`. Its adapter is code-complete
  only; manual verification is NEEDS_INPUT** (same treatment as Google
  OAuth).

### 5.4 API (`/api/v1`, ADR-022 contract)

Merchant: `GET/POST /merchant/products`, `GET/PATCH /merchant/products/{id}`,
`POST /merchant/products/{id}/{publish,unpublish,archive}`,
`POST/PATCH /merchant/products/{id}/variants[/{variantId}]`,
`POST /merchant/variants/{variantId}/stock-adjustments`,
`GET /merchant/variants/{variantId}/stock-movements`,
`POST/PATCH/DELETE /merchant/products/{id}/images[/{imageId}]`.
Public: `GET /categories` (active only).
Admin: `GET/POST /admin/categories`, `PATCH /admin/categories/{id}`
(rename, reorder, deactivate; no delete when products use it),
`GET /admin/products?status=`, `POST /admin/products/{id}/{unpublish,release}`.

### 5.5 Pages

| Path | Guard | Content |
|---|---|---|
| `/merchant/products` | requireApprovedMerchant | Desk catalog grid (image, category, name, price-from, stock, status badge); search `?q=`, status filter; empty state "Nothing in this collection yet." with "Add a product" |
| `/merchant/products/new` | same | Form: name, category, description, price, MRP, SKU, weight, dimensions, initial stock → creates DRAFT, goes to edit page |
| `/merchant/products/[id]` | same | Edit details; variants table (add/edit/deactivate); stock per variant with adjust dialog and recent movements; images (upload, alt, reorder, delete); status actions allowed for the current state with publish blockers listed |
| `/admin/categories` | requireAdmin | List, add, rename, reorder, activate/deactivate (admin look) |
| `/admin/products` | requireAdmin | List by status, unpublish / release hold (admin look) |

## 6. Testing and verification

- Unit: money parsing (₹ → paise, rounding, rejects 3 decimals/negatives),
  price ≤ MRP, SKU/slug rules, product status transitions, publishability.
- Integration (Testcontainers): create product + default variant + INITIAL
  movement in one transaction; SKU uniqueness per merchant (same SKU OK in
  two shops); cross-merchant ids → 404; concurrent stock adjustments never
  negative; concurrent publish/archive one winner; admin hold blocks
  republish; `listPurchasableProducts` excludes draft, unpublished,
  archived, out-of-stock, inactive category, suspended merchant; migration
  0003 additive with seeded categories.
- E2E (Playwright): approved merchant creates a product with two variants,
  uploads an image (local driver), adjusts stock, publishes, unpublishes,
  archives; non-approved merchant redirected; another merchant gets 404;
  admin adds a category and unpublishes a product with hold; landing page
  renders all sections, festival tabs work by keyboard, dialogs open/close,
  "Start selling" goes to onboarding; desk nav shows no Orders/Reviews;
  all Phase 2 E2E still green.
- Visual check: screenshots of source (`eacfe57`, served statically) vs port for landing (360, 768, 1366
  px) and desk products; reported honestly, not claimed pixel-perfect.
- Gate: typecheck, lint, knip, unit, integration, E2E, Compose smoke
  (0003 applied) — same isolation rule as Phase 2 (never `down -v` a stack
  this session did not create).

## 7. Constraints carried from earlier phases

No secrets in client bundles or logs; no Stripe/Razorpay; no fake success;
additive migrations only; `relivator_postgres_data` and the existing
`gillu` Compose stack are not touched; pages and handlers authorize
themselves; error contract ADR-022; one commit per plan task; no push/merge
without approval.

## 8. Left to the builder

Component file names and splitting; whether inventory is its own module;
how SKU uniqueness per merchant is enforced (denormalised `merchant_id` or
trigger-free check in a transaction); `next/image` vs plain `<img>` per
image; the local-disk adapter's directory and serving route; exact desk
CSS pruning; test fixture shapes.

## 9. Open inputs (NEEDS_INPUT, not blocking)

- UploadThing token — manual verification of the production image adapter.
- Google OAuth credentials — Phase 2 manual check (unchanged).
- Real product photography — landing previews use the illustrative images
  from `/opt/NH/gillu`.
