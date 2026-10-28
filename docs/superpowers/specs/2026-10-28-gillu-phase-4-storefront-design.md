# Gillu Phase 4 — Customer Storefront — Design

Status: DRAFT for approval (builder check done) · 2026-10-28 · branch `gillu/phase-4` (from `gillu/phase-3`)
Parent spec: [2026-10-27-gillu-marketplace-design.md](2026-10-27-gillu-marketplace-design.md)
Previous phase: [2026-10-27-gillu-phase-3-catalog-and-ui-design.md](2026-10-27-gillu-phase-3-catalog-and-ui-design.md)
Requirements: `diagrams/implementation-prompt.txt` Phase 4 checklist ("Integrate Gillu landing-page source, fetch products from DB, product detail pages, merchant shop pages, search and filters, cart, customer login"; deliver: *products from multiple merchants are visible and purchasable up to the checkout entry point*), §29 completion rule.
Brand source: `/opt/NH/gillu/docs/original-requirements.txt` (mission, audiences, "do not imply products are available when they are not").

## 1. Intent

Gillu sells the story first and the product second. A shopper should feel
that what they are looking at was made by real people in a real place —
handmade or homemade, close to nature — not pulled from a warehouse grid.
The original brief says it plainly: *bring India's undiscovered local
treasures to every home while empowering the people who create them.*

Phase 3 stored what a product **is** (name, price, stock, photos). Phase 4
adds what makes it **Gillu** — where it is from, who made it, how, and what
goes into it — makes merchants supply it, and builds the customer side
around it: browsing by region, category and craft; product pages; maker
shop pages that tell the maker's story; a cart that works without an
account; and sign-in at the checkout entry point.

## 2. Goals, non-goals, anti-goals

Goals
- Every published product carries its story: region, maker, handmade or
  homemade, ingredients (or materials). Every shop that sells carries its
  story: who they are, their village or town, photos of them at work.
- Shoppers find products by region, category and handmade/homemade, plus a
  search box, on one browse page with shareable URLs.
- Product pages and shop pages in the Gillu look (same CSS family, fonts,
  palette as the ported landing page).
- A guest can fill a cart; signing in at checkout keeps that cart.
- The landing page's product, region and category sections link to real
  data instead of illustrative previews.

Non-goals (this phase)
- Placing orders, customer addresses, stock reservations, payment,
  shipping (Phases 5–7). The checkout page stops before "Place order".
- Reviews, wishlists, recommendations, notifications.
- Restyling the sign-in/sign-up pages (they keep the current look; see §12).
- Admin review of shop stories or product stories (merchants publish them
  directly, as with products in Phase 3).
- Postgres full-text search, typo tolerance, search ranking.

Anti-goals (failure even if it "works")
- A product or region shown as buyable when it is not: nothing on the
  storefront may link to a product that is not purchasable, and a region
  with no products says so.
- A shop page with an empty or placeholder story.
- Any fake order success: the checkout page must not pretend an order was
  placed, reserve stock, or take payment.
- Trusting the browser for price or stock: the cart always reprices and
  rechecks stock on the server.
- The shop story getting in the way: a returning shopper must not have to
  scroll past the full story again.
- Breaking Phase 2/3 flows or their tests.

## 3. Decisions made with the user

| Topic | Decision |
|---|---|
| Product story fields | **Region, who made it, handmade or homemade, ingredients** |
| Missing story | **Block publishing** until all four are filled |
| Shop page content | **Their story, village or town, photos of them working** |
| Returning visitors | **Must be able to skip the intro; it must not be annoying every time** |
| Shop page layout | **Mockup A:** full story on the first visit, folds into a slim strip on later visits, "Skip to products" always present |
| Browsing | **By region, category, or handmade/homemade filter** |
| Cart and login | **Cart works without login; sign in only at checkout** |

Calls made by Claude during the conversation and not objected to (the user
said "looks good" to the playback): the state list + free-text place format
for region; "made by" defaulting to the shop name; one of Handmade/Homemade
(not both); "Materials" label for craft categories; existing published
products stay live with a notice; shop story required before products can
publish; story entered in the desk Profile page; `/explore` browse page with
search and sort; cart kept on the server behind a cookie; guest cart merges
into the account on sign-in; lines grouped by maker; checkout stops before
"Place order".

## 4. Product story

### 4.1 Fields (on `products`, migration 0005, all nullable in the database)

| Field | Column | Rule |
|---|---|---|
| Region — state | `origin_state` | One value from a fixed list of the 28 states and 8 union territories of India, stored as a slug (`goa`, `maharashtra`, `jammu-and-kashmir`, …). The list lives in code (`src/modules/catalog/domain/indian-states.ts`), with display names |
| Region — place | `origin_place` | Free text, trimmed, 2–60 chars: village, town or district ("Malvan", "Kutch") |
| Who made it | `made_by` | Free text, trimmed, 2–80 chars ("Lakshmi Sawant and her daughters"). The new-product form prefills it with the shop name; it is stored, not derived |
| Handmade or homemade | `made_how` | Enum `HANDMADE` \| `HOMEMADE` (exactly one) |
| Ingredients / materials | `composition` | Free text, trimmed, 3–1000 chars, line breaks kept |

Ingredients vs materials: `categories` gains `composition_label`
(`INGREDIENTS` \| `MATERIALS`, default `INGREDIENTS`). Migration 0005 sets
it for the seven seeded categories by slug (food categories → ingredients;
handmade art, handcrafted gifts and other craft categories → materials; the
builder reads the seed and assigns). Forms and pages label the field from
the product's category. The admin categories page gets a select for it.

### 4.2 Publish blockers

`publishBlockers` gains, in this order after the Phase 3 ones:
`origin` (state or place missing), `made_by`, `made_how`, `composition`,
and `shop_story` (the shop's story is incomplete, §5.2). Same error as
Phase 3: `409 not_publishable` "Add what is missing before publishing."
with `details.missing`. The desk's "Before you can publish:" list gains a
human line for each.

### 4.3 Products already published

They stay PUBLISHED and purchasable even with missing story fields (Gillu
has not launched; only test data exists). Their desk edit page shows a
notice listing what is missing ("Customers see this product, but it is
missing: …"). Unpublishing and republishing requires the fields. Storefront
pages render missing fields by leaving the line out — never "undefined",
never a placeholder.

**A live product cannot lose its story** (mirrors Phase 3's `last_image` /
`last_variant`): a PATCH that would blank or invalidate any story field of
a PUBLISHED product is refused with `409 story_required` "A published
product needs its story. Unpublish it first to clear this." Changing a
value to another valid value is always allowed. Products published before
Phase 4 that never had the fields are not affected until they set one.

### 4.4 Desk changes

New-product form and product details form get the five inputs (state
select, place, made by, a two-option radio for handmade/homemade, and a
textarea labelled from the category). Product card in the desk list shows
the made-how badge.

API: `POST /merchant/products` and `PATCH /merchant/products/{id}` accept
`originState`, `originPlace`, `madeBy`, `madeHow`, `composition` (optional
on create — a draft may be incomplete; validated when present; blank
clears on patch). ADR-022 error contract, field errors under the same keys.

## 5. Shop story

### 5.1 Fields

On `merchants` (migration 0005, nullable):

| Field | Column | Rule |
|---|---|---|
| Story | `story` | Trimmed, 150–3000 chars, paragraphs kept (rendered as paragraphs, no HTML/markdown) |
| Village or town | `home_place` | Trimmed, 2–60 chars |
| State | `home_state` | From the same state list as §4.1 |

New table `merchant_story_images` (`id`, `merchant_id` FK cascade,
`storage_key`, `url`, `alt` 1–200 default store name, `width`, `height`,
`bytes`, `content_type`, `sort_order`, timestamps). Up to **6** per shop,
same rules and storage as product images (ADR-029: magic-byte JPEG/PNG/WebP,
≤ 4 MB, `ImageStorage` port, local or UploadThing, delete-on-failure, the
limit re-checked under a merchant row lock). The first image is the cover.

### 5.2 Complete story

A shop's story is complete when `story`, `home_place`, `home_state` are set
and it has ≥ 1 story image. Incomplete → every product publish is blocked
with `shop_story`. Removing the last story photo while the shop has
published products is refused (`409 last_story_image`, mirrors
`last_image`), and so is any PATCH that would make a complete story
incomplete while the shop has published products (`409 story_required`).
Editing the story never needs admin re-approval.

**Shops without a complete story but with live products** (only test data
from before Phase 4): their products stay purchasable, but the storefront
hides every link to the shop page — the product page shows a plain
"Sold by <store name>" line instead of the maker panel, cart groups show the
store name without a link — so no page links to a 404.

### 5.3 Desk: "Your story"

A new section on the desk Profile page (`/merchant/profile`), Gillu desk
styling: story textarea with a character count, village/town, state
select, photo grid with upload, describe, reorder, remove (same controls as
product photos). Owner and staff of an APPROVED shop can edit it; DRAFT and
PENDING shops can also fill it in (so it is ready at approval). API under
`/api/v1/merchant/story` (GET, PATCH) and `/api/v1/merchant/story/images`
(POST, PATCH `{imageId}`, DELETE `{imageId}`), authorised by membership
(not by approval).

## 6. Storefront pages

All pages use the Gillu site look (`gillu-site.css` family, site header and
footer from the landing page). New CSS goes in the same `@scope` approach
as Phase 3 (ADR-026). Server components fetch from the catalog module;
client islands only where interaction needs them.

The site header gains **Explore** (→ `/explore`) and a **Cart** button
with a live count (hidden badge at 0).

### 6.1 Browse — `/explore`

- Query parameters: `q`, `region` (state slug), `category` (slug), `made`
  (`handmade` \| `homemade`), `sort` (`newest` default, `price_asc`,
  `price_desc`), `page` (1-based). Unknown or invalid values are ignored
  (page still renders), not 400.
- Filters combine (AND). Region options list only states that currently
  have purchasable products, each with a count. Category options are the
  active categories. A clear-all link resets.
- Search `q` (trimmed, ≤ 100 chars): case-insensitive substring match on
  product name, `made_by`, `origin_place`, `composition`, and the shop's
  store name.
- Results: only purchasable products (Phase 3 definition: PUBLISHED, no
  hold, active category, APPROVED shop, ≥ 1 active variant in stock).
  24 per page with numbered pagination. "Price from" is the lowest active
  in-stock variant price.
- Card: cover photo, name, price from, made-how badge, "Place, State",
  "by <made_by>"; links to the product page.
- Empty result: friendly empty state with the squirrel and a clear-filters
  link.
- Filters work without JavaScript (a GET form, `next/form`), with
  JavaScript applying them on change.

### 6.2 Product page — `/shops/[shop]/[product]`

- `[shop]` is the merchant slug, `[product]` the product slug (unique per
  shop). Not purchasable → 404 (same page as unknown). The starter
  `/products` and `/products/[id]` pages are removed.
- Shows: photo gallery (cover + thumbnails, keyboard operable), name,
  made-how badge, "From <Place>, <State>", "Made by <made_by>", price and,
  when MRP > price, the MRP struck through; description; the
  Ingredients/Materials block; variant picker (hidden when the only active
  variant is the unlabelled default; sold-out variants shown disabled);
  "Only N left" when ≤ 5; quantity stepper (1 to min(10, available));
  **Add to cart**; a maker panel (cover story photo, store name, place,
  first lines of the story) linking to the shop page.
- Page metadata: title, description, Open Graph image (cover).

### 6.3 Shop page — `/shops/[shop]` (mockup A)

- Visible only for APPROVED shops with a complete story; otherwise 404.
- **First visit:** full story at the top — eyebrow "Place · State", store
  name, story paragraphs, photo grid (cover large, others small), then the
  shop's purchasable products (same cards as §6.1, newest first).
- **Returning visit:** the story renders as a slim strip ("Store · Place,
  State · Read their story ▾"); expanding it shows the full story in place.
  Products come first.
- "Skip to products" link is always present at the top.
- "Seen" is remembered per shop in the browser, without an account. The
  returning layout must be rendered by the server (no flash of the full
  story then collapse); a first-party cookie listing recently seen shop
  slugs (capped, e.g. last 50) is the expected mechanism. Not a security
  boundary.
- A shop with a complete story but no purchasable products shows the story
  and "New finds coming soon."

### 6.4 Landing page wiring

- Region cards (Goa, Kerala, Maharashtra, Rajasthan) link to
  `/explore?region=<state>`. A region with no purchasable products keeps
  its card but shows "Coming soon" and does not link.
- The collection section ("A taste of what's to come") has three
  client-side tabs over three illustrative preview cards; it has no cards
  for the seven real categories. Once at least one purchasable product
  exists, the section switches to real data:
  - cards: the newest 3 purchasable products (fewer if fewer exist);
  - the three preview tabs are replaced by a row of category links (each
    active category that has purchasable products →
    `/explore?category=<slug>`) plus "Explore everything" → `/explore`;
  - the "taste of what's to come" eyebrow and the "Collection previews ·
    Illustrative imagery" disclaimer are removed (they describe previews).
  With no purchasable products, the section stays exactly as today
  (previews, tabs, disclaimer).
- Hero "Explore" call to action → `/explore`.
- Festival tabs and the story section stay as they are.

## 7. Cart

### 7.1 Storage

Tables (migration 0005):
- `carts`: `id`, `user_id` (nullable, unique, FK cascade),
  `guest_token_hash` (nullable, unique; SHA-256 of the cookie token),
  `created_at`, `updated_at`. Exactly one of `user_id` / `guest_token_hash`
  is set (CHECK).
- `cart_items`: `id`, `cart_id` FK cascade, `variant_id` FK cascade,
  `quantity` (1–10, CHECK), `unit_price_paise_seen` (the price when added
  or last acknowledged), timestamps; unique (`cart_id`, `variant_id`).

Guest cookie: `gillu_cart`, 32 random bytes base64url, `HttpOnly`,
`SameSite=Lax`, `Secure` in production, `Path=/`, 30-day max-age refreshed
on each cart write. Only its hash is stored. A guest cart is created on the
first add, not on page view.

### 7.2 Rules

- At most 30 lines per cart; quantity 1–10 per line and never above the
  variant's available stock at the time of the write (`409 insufficient_stock`
  with the available number).
- Only purchasable products' active variants can be added
  (`409 not_purchasable` otherwise); unknown variant → 404.
- Adding an existing line increases its quantity (capped as above).
- Reading the cart reprices every line from the catalog and attaches a
  per-line status: `ok`, `price_changed` (current ≠ seen; shows old → new;
  acknowledging updates `unit_price_paise_seen`), `short` (quantity >
  available; shows "Only N left"), `sold_out`, `unavailable` (no longer
  purchasable). Lines are never silently deleted; the shopper removes or
  fixes them.
- Lines are grouped by shop, each group with its store name, link and
  subtotal; a grand total of `ok`/`price_changed` lines.
- **Merge on sign-in:** when a signed-in request arrives with a guest
  cookie, the guest cart's lines merge into the user's cart, the guest
  cart is deleted and the cookie cleared. Done lazily on the next cart
  read or write, in one transaction; running it twice changes nothing.
  - A variant in both carts: quantities summed, capped at 10 (not at
    stock — the `short` / `sold_out` status then tells the shopper).
  - Sold-out or no-longer-purchasable guest lines move across unchanged
    and show their status, like any other line.
  - Guest lines beyond the 30-line limit (oldest user lines kept first,
    then guest lines by when they were added) are dropped, and the next
    cart view carries `mergeDropped: N`, shown once as "N items from your
    earlier cart did not fit (30 items max)."
  - Stock caps on writes (above) apply to adds and quantity changes, not to
    the merge.

### 7.3 API (`/api/v1`, ADR-022 contract, no session required)

| Method & path | Body | Result |
|---|---|---|
| `GET /cart` | — | cart view (groups, lines with status, totals, count) |
| `POST /cart/items` | `{ variantId, quantity }` | 201 cart view |
| `PATCH /cart/items/{variantId}` | `{ quantity }` or `{ acknowledgePrice: true }` | cart view |
| `DELETE /cart/items/{variantId}` | — | cart view |

Public read endpoints (requirements §22 customer APIs), sharing the same
queries and purchasable rule as the pages, no session, `no-store` not
required (short public caching allowed):

| Method & path | Result |
|---|---|
| `GET /products` | `searchStorefront` with the §6.1 query parameters (invalid values → 400 `validation_failed` here, unlike the page) |
| `GET /shops/{shop}` | shop with complete story + its purchasable products; 404 otherwise |
| `GET /shops/{shop}/products/{product}` | purchasable product detail; 404 otherwise |

Requirements name `GET /products/:slug`; product slugs are unique only per
shop, so the product lives under its shop. Cart lines are keyed by
`variantId` (a cart line is one variant), not by a line id.

Mutations require `content-type: application/json` (so a cross-site form
cannot post) and rely on `SameSite=Lax` cookies. Responses `no-store`.

### 7.4 Cart page — `/cart`

A page (not a drawer), Gillu site look: groups by maker with photo, name,
variant label, unit price, quantity stepper, remove, status messages;
totals; **Checkout** button (disabled while any line is not `ok`, with the
reason). Adding from a product page shows an inline "Added to cart · View
cart" confirmation and updates the header count. Empty cart: squirrel empty
state with a link to `/explore`.

## 8. Customer login and the checkout entry point

- Customers use the existing better-auth accounts (email + password now;
  Google when credentials exist). Any account can shop, including merchant
  members.
- `/checkout` requires a session: signed-out → existing sign-in page with
  `?next=/checkout` (Phase 2's safe-redirect rule), which also links to
  sign-up carrying `next`.
- After sign-in the cart merge (§7.2) runs; `/checkout` shows the cart
  grouped by maker with totals and any line problems (with a link back to
  `/cart` to fix them).
- The **Place order** button is visible but disabled, with the note
  "Ordering opens soon — your cart is saved." No order rows, no stock
  holds, no payment calls. This is the "checkout entry point" of the
  deliverable.

## 9. Catalog module changes (summary)

- `listPurchasableProducts` grows into a storefront query:
  `searchStorefront(db, { q, region, category, made, sort, page })` →
  `{ items, total, page, pageSize, regionCounts }`; plus
  `getStorefrontProduct(db, shopSlug, productSlug)` and
  `getStorefrontShop(db, shopSlug)`. All share one "purchasable" condition.
- New `cart` module (`src/modules/cart`) owning tables, rules, merge and
  cart view; it reads purchasability from the catalog module's public API.
- Merchant story lives in the merchants module (fields, images via the
  catalog `ImageStorage` port).

## 10. Migration 0005 (additive only)

New nullable columns on `products`, `merchants`, `categories`
(`composition_label` with default); new enum types for made-how and
composition label; new tables `merchant_story_images`, `carts`,
`cart_items`; indexes for storefront filters (`products(origin_state)`,
`products(made_how)`, `products(status, published_at)`), and data update
of `composition_label` for the seeded categories. No drops, no renames, no
NOT NULL on existing rows.

## 11. Testing and verification

- Unit: state list and slugs; story field schemas (length, trimming,
  blank-clears); new publish blockers and their order; cart line status
  calculation; explore query-param parsing (invalid values ignored).
- Integration (Testcontainers): publish blocked for each missing story
  field and for an incomplete shop story; existing published product with
  missing fields stays purchasable; `searchStorefront` filters (each alone
  and combined), search fields, sort orders, pagination, region counts,
  exclusions (draft, held, hidden category, suspended shop, sold out);
  story images limit under concurrency and `last_story_image`; cart add /
  update / remove, stock and line caps, not-purchasable add, status after
  price change / sell-out / unpublish, guest→user merge (summing, caps,
  cookie cleared, idempotent), one guest cart never readable with another
  token.
- E2E (Playwright): merchant fills shop story with a photo and a product's
  story fields, publishes; publishing without them shows the missing list;
  guest browses `/explore` by region, category, made and search, opens a
  product, picks a variant, adds to cart, sees the header count; cart from
  two shops grouped; shop page first visit shows the story, reload shows
  the strip, "Read their story" expands it, "Skip to products" works; guest
  clicks Checkout → sign-in → back to `/checkout` with the same cart and a
  disabled "Place order"; landing region with no products shows "Coming
  soon"; 360 px no horizontal scroll on explore, product, shop, cart pages;
  all Phase 2–3 E2E still green.
- Gate: typecheck, lint, knip, unit, integration, E2E, Compose smoke
  (0005 applied; `/explore` 200; `/api/v1/cart` 200 empty cart for a guest)
  with the Phase 2/3 isolation rule.

## 12. Constraints carried from earlier phases

No secrets in client bundles or logs; no Stripe/Razorpay; no fake success;
additive migrations only; `relivator_postgres_data` and the existing
`gillu` Compose stack are not touched; pages and handlers authorize
themselves; error contract ADR-022; one commit per plan task; no
push/merge without approval. The sign-in/sign-up pages keep their current
look this phase (restyling them is a separate, small follow-up if wanted).

## 13. Left to the builder

Component and file names; how the explore query is built in Drizzle;
pagination component; gallery implementation; exact cookie format for
"seen shops"; whether cart count in the header is fetched client-side or
rendered by the server per request; CSS details within the Gillu palette;
which seeded categories get `MATERIALS` (by reading the seed); test fixture
shapes; whether story image handling reuses product image code through a
shared helper.

## 14. Open inputs (NEEDS_INPUT, not blocking)

- Google OAuth credentials — customer and merchant Google sign-in (Phase 2
  manual check, unchanged).
- Real maker stories and photos — the app ships with none; storefront pages
  stay empty or "Coming soon" until merchants add them.
