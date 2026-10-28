# Gillu Phase 5 — Internal Order System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in shopper places a Cash-on-delivery order from a multi-maker cart; Gillu stores one order with one part per maker, holds the stock, and each maker works their part (preparing → packing → packed) or cancels it; shoppers see and cancel their orders; merchants and shoppers can sign out.

**Architecture:** Migration 0006 adds the order tables, a number sequence and two stock-movement reasons. A new `orders` module owns addresses, placement, order reads, transitions and the merchant views; it calls the catalog module for stock (`reserveStock` / `releaseStock` / `consumeStock` on `inventory`) and the cart module for locking and clearing the cart, all inside one transaction. Pages: real `/checkout`, `/orders`, `/orders/[number]`, `/account/addresses` in the `(site)/(store)` group; `/merchant/orders` and `/merchant/orders/[id]` in the desk.

**Tech Stack:** Next.js 16.4 App Router, React 19.3, TypeScript 5.9, drizzle-orm 0.45 / drizzle-kit 0.31 on Postgres 16, Zod 4, better-auth 1.7, Vitest + Testcontainers, Playwright, bun.

**Spec:** `docs/superpowers/specs/2026-10-28-gillu-phase-5-orders-design.md` (parent: `docs/superpowers/specs/2026-10-27-gillu-marketplace-design.md`; requirements `diagrams/implementation-prompt.txt` §11, §12, §13, §14, §16, §18, §19, §26, §29).

## Global Constraints

- Every Bash call: `export PATH=$HOME/.bun/bin:$PATH`. `timeout` with a multi-word command needs `bash -c "…"`.
- Status names exactly as requirements §18 (spec §4.1). Shopper/maker words exactly as the spec §4.1 table.
- COD orders are `CONFIRMED` + payment `UNPAID` at placement; never `PAID`/`PREPAID`.
- Money: integer paise, `bigint` `mode: "number"`, `CHECK (>= 0)`. Delivery charge 0 on every order and part. Order total = sum of part totals; COD `cod_amount_paise` = part total.
- Order numbers `GIL-<n>` from sequence `order_number_seq` starting at 1001; parts `GIL-<n>-A`, `-B`, … in the order makers first appear in the cart (by first cart line `created_at`).
- Stock: `available ≥ 0` and `reserved ≥ 0` always; variants locked/updated in ascending variant id. Movements record changes to `available` only (`delta ≠ 0` stays).
- Release modes: shopper cancel and maker `CANNOT_FULFIL`/`OTHER` → `release` (back on sale); maker `OUT_OF_STOCK`/`DAMAGED` → `write_off` (reserved only).
- Every route authorizes itself (`authorizeSession` / `requireSession` for shoppers, `authorizeApprovedMerchant` / `requireApprovedMerchant` for merchants); merchant id only from the membership; another user's or shop's id → 404.
- API contract ADR-022 (`apiRoute`, `ok`, `parseJson`, `parseQuery`, `AppError` subclasses), `no-store`.
- Migrations additive only. Never touch `relivator_postgres_data` or the `gillu` Compose stack; smoke as project `gillu-smoke`, port 18080.
- Cross-module calls use sub-path imports (`~/modules/catalog/application/…`, `~/modules/cart/application/…`) where an `index.ts` imports `server-only` (Phase 4 ruling).
- No fake data. Stage files by path; never `git add -A`. One commit per task ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. No push/merge.
- Library APIs new to this codebase (drizzle `pgSequence`) are checked with `npx ctx7@latest` before use.

## Review Focus

1. **Double "Place order"** — double click, retry after a timeout, two tabs with the same page: exactly one order; the repeat answers 200 with the same order. Pinned in Task 5 (sequential and concurrent same key).
2. **Last piece, two shoppers** (Scenario H) — both place at once: one order, the other `409 insufficient_stock`, `available` 0, `reserved` = 1, never negative. Pinned in Task 5.
3. **Shopper and maker cancel the same part at once** — one wins, the other gets `409 invalid_transition`, stock released or written off exactly once. Pinned in Task 6.
4. **The cart changes between checkout page and press** — price changed, sold out, unpublished, shop suspended, total differs: no order, no stock moved, clear error, cart untouched. Pinned in Task 5.
5. **Cross-tenant access** — another shopper's order number or address, another shop's part id, via page and API: 404 with no data. Pinned in Tasks 4, 6, 9.

---

## File Structure

```
drizzle/0006_*.sql                                   migration (generated)
src/db/schema/orders/{tables,relations}.ts           orders, merchant_orders, order_items, snapshots, history, reservations, addresses, sequence
src/modules/catalog/domain/constants.ts              + ORDER_RESERVED, ORDER_RELEASED; MERCHANT_STOCK_REASONS
src/modules/catalog/application/reservations.ts      reserveStock, releaseStock, consumeStock
src/modules/cart/application/checkout-cart.ts        lockUserCart, removeCartLines
src/modules/orders/domain/{statuses,transitions,derive,numbers,labels}.ts
src/modules/orders/presentation/schemas.ts           address, place, cancel, status schemas
src/modules/orders/application/{addresses,place-order,views,transition,shopper-orders,merchant-orders}.ts
src/modules/orders/index.ts
src/app/api/v1/account/addresses/**, src/app/api/v1/orders/**, src/app/api/v1/merchant/orders/**
src/app/(site)/(store)/{checkout,orders,orders/[number],account/addresses}/page.tsx
src/app/merchant/orders/{page,[id]/page}.tsx
src/ui/gillu/store/{checkout-form,address-form,address-list,order-parcels,cancel-order}.client.tsx, order-status.tsx
src/ui/gillu/desk/{merchant-order-actions.client,sign-out.client}.tsx
```

---

### Task 1: Order domain and schemas

**Files:**
- Create: `src/modules/orders/domain/{statuses,transitions,derive,numbers,labels}.ts`, `src/modules/orders/presentation/schemas.ts`
- Modify: `src/modules/catalog/domain/constants.ts`, `src/modules/catalog/presentation/schemas.ts`, `src/modules/merchants/presentation/schemas.ts` (export `phoneSchema`)
- Test: `tests/unit/orders/domain.test.ts`, `tests/unit/orders/schemas.test.ts`, `tests/unit/catalog/schemas.test.ts`

**Interfaces:**
- Produces:
  - `statuses.ts`: `ORDER_STATUSES`, `PAYMENT_STATUSES`, `PAYMENT_METHODS`, `FULFILMENT_STATUSES`, `RESERVATION_STATUSES = ["HELD","RELEASED","WRITTEN_OFF","CONSUMED"]`, `MAKER_CANCEL_REASONS = ["OUT_OF_STOCK","DAMAGED","CANNOT_FULFIL","OTHER"]`, `ACTOR_ROLES = ["SHOPPER","MERCHANT","SYSTEM"]` (all `as const`, §18 order) and their types `OrderStatus`, `PaymentStatus`, `PaymentMethod`, `FulfilmentStatus`, `ReservationStatus`, `MakerCancelReason`, `ActorRole`; `MERCHANT_STEPS = ["ACKNOWLEDGED","PACKING","READY_FOR_PICKUP"] as const`.
  - `transitions.ts`: `canTransition(from: FulfilmentStatus, to: FulfilmentStatus, actor: ActorRole): boolean` — MERCHANT: NEW→ACKNOWLEDGED, ACKNOWLEDGED→PACKING, PACKING→READY_FOR_PICKUP; SYSTEM: READY_FOR_PICKUP→HANDED_TO_COURIER, HANDED_TO_COURIER→FULFILLED; SHOPPER and MERCHANT: any of NEW…HANDED_TO_COURIER → CANCELED. Nothing else. `releaseMode(actor: ActorRole, reason: MakerCancelReason | null): "release" | "write_off"`.
  - `derive.ts`: `deriveOrderStatus(parts: FulfilmentStatus[]): OrderStatus` (spec §4.2 rules, in that order).
  - `numbers.ts`: `orderNumber(n: number): string` (`GIL-1001`), `partLetter(index: number): string` (0→`A`, 25→`Z`, 26→`AA`), `partNumber(order: string, index: number): string`, `ORDER_NUMBER_START = 1001`.
  - `labels.ts`: `MAKER_STATUS_TEXT`, `SHOPPER_STATUS_TEXT` (`Record<FulfilmentStatus, string>`, spec §4.1 table), `MAKER_CANCEL_TEXT` (`OUT_OF_STOCK` "Out of stock", `DAMAGED` "Damaged", `CANNOT_FULFIL` "Can't fulfil this order", `OTHER` "Other").
  - catalog constants: `STOCK_REASONS` gains `"ORDER_RESERVED"`, `"ORDER_RELEASED"` (appended); `MERCHANT_STOCK_REASONS = ["RESTOCK","DAMAGED","CORRECTION","OTHER"] as const`; the stock-adjustment schema uses `z.enum(MERCHANT_STOCK_REASONS)` (the desk dialog reads the same list).
  - `schemas.ts`: `addressSchema` (`fullName` 2–80, `phone` = merchants `phoneSchema`, `line1` 3–200, `line2` optional ≤ 200, `landmark` optional ≤ 80, `city` 2–80, `state` state slug "Choose a state from the list.", `postalCode` 6-digit "Enter a 6-digit PIN code.", `isDefault` optional boolean); `addressPatchSchema` (partial, non-empty); `placeOrderSchema` (`addressId` string, `checkoutKey` 16–64 chars `[A-Za-z0-9_-]`, `paymentMethod` enum, `expectedTotalPaise` int ≥ 0); `shopperCancelSchema` (`merchantOrder?` `/^GIL-\d+-[A-Z]+$/`, `reason?` ≤ 300); `merchantStatusSchema` (`to` ∈ `MERCHANT_STEPS`); `merchantCancelSchema` (`reason` enum, `note?` ≤ 300, note required when `OTHER`: "Say why you are cancelling."). Types `AddressInput`, `AddressPatch`, `PlaceOrderInput`.

- [ ] **Step 1: Write the failing tests**

```ts
test("merchant steps, system steps and cancel", () => {
  expect(canTransition("NEW", "ACKNOWLEDGED", "MERCHANT")).toBe(true);
  expect(canTransition("NEW", "PACKING", "MERCHANT")).toBe(false);
  expect(canTransition("READY_FOR_PICKUP", "HANDED_TO_COURIER", "MERCHANT")).toBe(false);
  expect(canTransition("READY_FOR_PICKUP", "HANDED_TO_COURIER", "SYSTEM")).toBe(true);
  expect(canTransition("HANDED_TO_COURIER", "CANCELED", "SHOPPER")).toBe(true);
  expect(canTransition("FULFILLED", "CANCELED", "SHOPPER")).toBe(false);
  expect(canTransition("CANCELED", "CANCELED", "MERCHANT")).toBe(false);
});
test("release mode", () => {
  expect(releaseMode("SHOPPER", null)).toBe("release");
  expect(releaseMode("MERCHANT", "CANNOT_FULFIL")).toBe("release");
  expect(releaseMode("MERCHANT", "OUT_OF_STOCK")).toBe("write_off");
  expect(releaseMode("MERCHANT", "DAMAGED")).toBe("write_off");
});
test("order status derives from parts", () => {
  expect(deriveOrderStatus(["NEW", "NEW"])).toBe("CONFIRMED");
  expect(deriveOrderStatus(["NEW", "PACKING"])).toBe("PROCESSING");
  expect(deriveOrderStatus(["FULFILLED", "PACKING"])).toBe("PARTIALLY_FULFILLED");
  expect(deriveOrderStatus(["FULFILLED", "CANCELED"])).toBe("COMPLETED");
  expect(deriveOrderStatus(["CANCELED", "CANCELED"])).toBe("CANCELED");
  expect(deriveOrderStatus(["CANCELED", "NEW"])).toBe("CONFIRMED");
});
test("numbers", () => {
  expect(orderNumber(1001)).toBe("GIL-1001");
  expect([0, 1, 25, 26].map(partLetter)).toEqual(["A", "B", "Z", "AA"]);
  expect(partNumber("GIL-1001", 1)).toBe("GIL-1001-B");
});
// schemas
expect(addressSchema.safeParse({ ...valid, postalCode: "012345" }).success).toBe(false);
expect(addressSchema.parse({ ...valid, phone: "98765 43210" }).phone).toBe("+919876543210");
expect(merchantCancelSchema.safeParse({ reason: "OTHER" }).success).toBe(false);
expect(placeOrderSchema.safeParse({ ...placeValid, checkoutKey: "short" }).success).toBe(false);
// catalog: merchant adjustment refuses order reasons
expect(stockAdjustmentSchema.safeParse({ delta: 1, reason: "ORDER_RELEASED" }).success).toBe(false);
```

- [ ] **Step 2: Run** `bun run test:unit -- tests/unit/orders tests/unit/catalog/schemas.test.ts` — Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** the Produces list.
- [ ] **Step 4: Run** same + `bun run typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(orders): order states, transitions, numbers and schemas`

---

### Task 2: Migration 0006

**Files:**
- Create: `src/db/schema/orders/tables.ts`, `src/db/schema/orders/relations.ts`, `drizzle/0006_*.sql` (+ meta)
- Modify: `src/db/schema/index.ts`, `src/db/schema/users/relations.ts` (if needed for relations)
- Test: `tests/integration/db/migrations.test.ts` (new `describe("Phase 5 (migration 0006)")`)

**Interfaces:**
- Consumes: Task 1 constants (relative imports, as the catalog schema does).
- Produces (all `created_at`/`updated_at` timestamptz, text cuid2 ids):
  - `orderNumberSeq` — `pgSequence("order_number_seq", { startWith: 1001 })` (check the drizzle 0.45 API with ctx7 first).
  - `customerAddressesTable` `customer_addresses`: `user_id` → user cascade, `full_name`, `phone`, `line1`, `line2`, `landmark`, `city`, `state`, `postal_code` (CHECK `customer_addresses_postal_code` `^[1-9][0-9]{5}$`), `is_default` bool default false; partial unique index `customer_addresses_one_default` on `user_id` WHERE `is_default`; index on `user_id`.
  - `ordersTable` `orders`: `number` unique, `user_id` → user restrict, `status` (`order_status`), `payment_method`, `payment_status`, `checkout_key`, `items_total_paise`, `delivery_paise` default 0, `total_paise`; unique `orders_user_checkout_key_unique (user_id, checkout_key)`; index on `user_id`.
  - `merchantOrdersTable` `merchant_orders`: `number` unique, `order_id` → orders cascade, `merchant_id` → merchants restrict, `fulfilment_status` default NEW, `items_total_paise`, `delivery_paise` default 0, `total_paise`, `cod_amount_paise` nullable, nullable `courier_estimate_paise`, `courier_charge_paise`, `payment_fee_paise`, `cancel_reason` (`maker_cancel_reason`) nullable, `cancel_note`, `canceled_by` (`actor_role`) nullable, `canceled_at`; unique `(order_id, merchant_id)`; index `(merchant_id, fulfilment_status)`.
  - `orderItemsTable` `order_items`: `merchant_order_id` → cascade, `product_id` → products set null, `variant_id` → product_variants set null, `product_name`, `product_slug`, `variant_label`, `sku`, `unit_price_paise`, `declared_mrp_paise` nullable, `quantity` (CHECK > 0), `line_total_paise`, `cover_image_url`.
  - `orderAddressSnapshotsTable` `order_address_snapshots`: `order_id` PK → orders cascade, same address fields as `customer_addresses` (no `is_default`).
  - `orderStatusHistoryTable` `order_status_history`: `merchant_order_id` → cascade, `from_status` nullable, `to_status`, `actor_role`, `actor_user_id` → user set null, `reason`, `note`; index on `merchant_order_id`.
  - `inventoryReservationsTable` `inventory_reservations`: `order_item_id` unique → order_items cascade, `variant_id` → product_variants restrict, `quantity` CHECK > 0, `status` (`reservation_status`) default HELD; index on `variant_id`.
  - Every money column `CHECK (>= 0)`. `inventory_movement_reason` gains `ORDER_RESERVED`, `ORDER_RELEASED` (generated `ALTER TYPE … ADD VALUE`).

- [ ] **Step 1: Write the failing test** (pattern of the Phase 4 block): `nextval('order_number_seq')` ≥ 1001; a second default address for one user → `customer_addresses_one_default`; duplicate `(user_id, checkout_key)` → `orders_user_checkout_key_unique`; `order_items.quantity = 0` → its CHECK; negative `total_paise` → its CHECK; enum `inventory_movement_reason` contains `ORDER_RELEASED`.
- [ ] **Step 2: Run** `bun run test:integration -- tests/integration/db/migrations.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the schema; `bun run db:generate`; read the SQL: only `CREATE TYPE`, `CREATE SEQUENCE`, `CREATE TABLE`, `ALTER TYPE … ADD VALUE`, `ADD CONSTRAINT`, `CREATE INDEX` — no `DROP`, no change to existing columns.
- [ ] **Step 4: Run** the test and `bun run test:integration` — Expected: PASS, all earlier tests still pass.
- [ ] **Step 5: Commit** `feat(db): migration 0006 for orders, addresses and stock reservations`

---

### Task 3: Stock reservation in the catalog, checkout helpers in the cart

**Files:**
- Create: `src/modules/catalog/application/reservations.ts`, `src/modules/cart/application/checkout-cart.ts`
- Modify: `src/modules/catalog/application/storefront.ts` (`CartVariantInfo` + `sku`, `declaredMrpPaise`; `getVariantsForCart` accepts an `Executor`), `src/modules/catalog/application/variants.ts` / desk stock dialog (use `MERCHANT_STOCK_REASONS`)
- Test: `tests/integration/catalog/reservations.test.ts`, `tests/integration/cart/checkout-cart.test.ts`

**Interfaces:**
- Produces:
  - `reserveStock(tx: Transaction, items: StockLine[], actorUserId: string): Promise<void>` with `StockLine = { quantity: number; variantId: string }` — ascending variant id; guarded `available = available - q, reserved = reserved + q WHERE available >= q`; movement `ORDER_RESERVED` (delta −q, `available_after`); zero rows → `ConflictError("insufficient_stock", "<product name> is sold out." | "Only N left of <product name>.", { available, variantId })`.
  - `releaseStock(tx, items: StockLine[], mode: "release" | "write_off", actorUserId: null | string): Promise<void>` — release: `available += q, reserved -= q` + movement `ORDER_RELEASED` (+q); write_off: `reserved -= q` only, no movement; guard `reserved >= q` (else `Error`, a bug).
  - `consumeStock(tx, items: StockLine[]): Promise<void>` — `reserved -= q`, guarded.
  - `lockUserCart(tx: Transaction, userId: string): Promise<null | { cartId: string; lines: { createdAt: Date; quantity: number; unitPricePaiseSeen: number; variantId: string }[] }>` — `FOR UPDATE` on the cart row, lines by `created_at`, `id`.
  - `removeCartLines(tx: Transaction, cartId: string, variantIds: string[]): Promise<void>`.

- [ ] **Step 1: Write the failing tests.** Reservations: reserve 2 of 5 → available 3, reserved 2, one `ORDER_RESERVED` movement (delta −2, after 3); reserving 6 of 5 inside a transaction rejects with `insufficient_stock`, `details.available` 5, and nothing changed after rollback; two lines where the second fails → first line unchanged after rollback; release → back to 5/0 + `ORDER_RELEASED` (+2); write_off → available 3, reserved 0, no new movement; consume → reserved 0, available unchanged; release more than reserved → throws. Merchant `adjustStock` with reason `ORDER_RELEASED` is refused by the schema (unit test exists from Task 1) and existing stock tests still pass. Checkout cart: `lockUserCart` returns lines in add order; null for a user without a cart; `removeCartLines` removes only the given variants.
- [ ] **Step 2: Run** `bun run test:integration -- tests/integration/catalog/reservations.test.ts tests/integration/cart/checkout-cart.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** same + `bun run test:integration -- tests/integration/catalog tests/integration/cart` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(catalog): reserve, release and write off stock for orders`

---

### Task 4: Shopper addresses

**Files:**
- Create: `src/modules/orders/application/addresses.ts`, `src/modules/orders/index.ts`, `src/app/api/v1/account/addresses/route.ts`, `src/app/api/v1/account/addresses/[id]/route.ts`
- Test: `tests/integration/orders/addresses.test.ts`, `tests/e2e/addresses-api.spec.ts`

**Interfaces:**
- Produces:
  - `interface AddressView { city; fullName; id; isDefault: boolean; landmark: null | string; line1; line2: null | string; phone; postalCode; state: StateSlug }`.
  - `listAddresses(db, userId): Promise<AddressView[]>` (default first, then newest); `createAddress(db, userId, input: AddressInput): Promise<AddressView>` (first address is default; `isDefault: true` clears the others in the same transaction; 11th → `ConflictError("address_limit", "You can save up to 10 addresses.")`); `updateAddress(db, userId, id, patch: AddressPatch): Promise<AddressView>`; `deleteAddress(db, userId, id): Promise<void>` (deleting the default makes the newest remaining one default); `getAddress(db: Executor, userId, id): Promise<AddressView>` (another user's or unknown → `NotFoundError("Address not found.")`). `MAX_ADDRESSES = 10`.
  - Routes: `GET`/`POST /api/v1/account/addresses` (201), `PATCH`/`DELETE /api/v1/account/addresses/{id}` (`DELETE` → `ok(null)`); `authorizeSession()`.

- [ ] **Step 1: Write the failing tests.** Integration: first address default; second with `isDefault` moves the default; 11th → `address_limit`; delete default promotes the newest; other user's id → 404 for get/update/delete; patch keeps unspecified fields. E2E API: signed out → 401 JSON with `requestId`; signed in POST → 201, GET lists it; bad PIN → 400 with `details.postalCode`.
- [ ] **Step 2: Run** `bun run test:integration -- tests/integration/orders/addresses.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** same + `bun run test:e2e -- tests/e2e/addresses-api.spec.ts` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(orders): shopper delivery addresses with API`

---

### Task 5: Placing an order

**Files:**
- Create: `src/modules/orders/application/place-order.ts`, `src/modules/orders/application/views.ts`, `src/app/api/v1/orders/route.ts`
- Test: `tests/integration/orders/place-order.test.ts`, `tests/integration/support/orders.ts`

**Interfaces:**
- Consumes: Task 3 `lockUserCart`, `removeCartLines`, `reserveStock`, `getVariantsForCart`; `lineStatus`; Task 4 `getAddress`; Task 1 numbers/derive.
- Produces:
  - `views.ts`: `interface OrderItemView { coverImageUrl; lineTotalPaise; productName; productSlug; quantity; unitPricePaise; variantLabel }`; `interface PartView { canceledBy: ActorRole | null; cancelNote: null | string; cancelReason: MakerCancelReason | null; codAmountPaise: null | number; items: OrderItemView[]; number; shopLinkable: boolean; shopSlug; status: FulfilmentStatus; storeName; totalPaise }`; `interface OrderView { address: AddressSnapshot; createdAt: string; deliveryPaise: number; itemsTotalPaise; number; parts: PartView[]; paymentMethod; paymentStatus; status: OrderStatus; totalPaise }`; `loadOrderView(db: Executor, orderId: string): Promise<OrderView>`.
  - `placeOrder(db: Database, userId: string, input: PlaceOrderInput): Promise<{ created: boolean; order: OrderView }>`:
    1. existing order for `(userId, checkoutKey)` → `{ created: false }`;
    2. `PREPAID` → `ConflictError("payment_method_unavailable", "Online payment is coming soon. Choose cash on delivery.")`;
    3. in one transaction: `lockUserCart`; none/empty → `ConflictError("cart_empty", "Your cart is empty.")`; read variants; any line not `ok` (by `lineStatus`) → `ConflictError("cart_needs_attention", "Some items in your cart need attention.")`; `getAddress` (404); server total ≠ `expectedTotalPaise` → `ConflictError("price_changed", "Your total changed. Check your cart and try again.", { totalPaise })`; `nextval`; insert order (`CONFIRMED`, `UNPAID`, `COD`), address snapshot, parts (letters by first appearance), items (snapshots incl. `sku`, `declaredMrpPaise`), `reserveStock`, reservations `HELD`, history `null → NEW` (actor `SHOPPER`); `removeCartLines`;
    4. unique violation on `orders_user_checkout_key_unique` → return the existing order (`created: false`).
  - `POST /api/v1/orders`: `authorizeSession()`; `readCartOwner()` + `getCart()` + `applyCartCookie()` first (merges a guest cart); `parseJson(placeOrderSchema)`; `ok(order, created ? 201 : 200)`.
  - Test support `seedCartOrder(db, opts)` in `tests/integration/support/orders.ts`: shopper, address, two approved shops with published products, cart lines; returns ids and expected total.

- [ ] **Step 1: Write the failing tests.**
  - two-shop cart → one order `GIL-<n>` (n ≥ 1001), parts `-A` (first shop added) and `-B`; items carry name, label, sku, unit price, MRP, quantity, line total; part totals sum to the order total; `codAmountPaise` = part total; `CONFIRMED`/`UNPAID`/`COD`; parts `NEW`; one history row per part; `available` down and `reserved` up by each quantity with `ORDER_RESERVED` movements; the cart is empty; address snapshot equals the address.
  - same key again → `created: false`, same number, stock unchanged; `Promise.all` of two calls with one key → one order.
  - empty cart → `cart_empty`; a line whose price changed after it was added → `cart_needs_attention`; `expectedTotalPaise` off by 1 → `price_changed` with `details.totalPaise`; `PREPAID` → `payment_method_unavailable`; another user's address → 404; in each case no order row, stock and cart unchanged.
  - product unpublished / shop suspended between add and place → `cart_needs_attention`.
  - **Scenario H:** two shoppers, each with the last unit (stock 1) in their cart, `Promise.all(placeOrder…)` → exactly one fulfilled, the other `insufficient_stock`; `available` 0, `reserved` 1.
- [ ] **Step 2: Run** `bun run test:integration -- tests/integration/orders/place-order.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** same + `bun run test:integration` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(orders): place a cash-on-delivery order split by maker`

---

### Task 6: Order reads, cancellation and maker steps

**Files:**
- Create: `src/modules/orders/application/{transition,shopper-orders,merchant-orders}.ts`; routes `src/app/api/v1/orders/[number]/route.ts`, `src/app/api/v1/orders/[number]/cancel/route.ts`, `src/app/api/v1/merchant/orders/route.ts`, `src/app/api/v1/merchant/orders/[id]/route.ts`, `…/[id]/status/route.ts`, `…/[id]/cancel/route.ts`; `GET` added to `src/app/api/v1/orders/route.ts`
- Test: `tests/integration/orders/fulfilment.test.ts`, `tests/e2e/orders-api.spec.ts`

**Interfaces:**
- Produces:
  - `transition.ts`: `applyTransition(tx, partId: string, to: FulfilmentStatus, actor: { role: ActorRole; userId: null | string }, cancel?: { note?: string; reason: MakerCancelReason | null }): Promise<void>` — locks the order row then the part (`FOR UPDATE`), refuses with `ConflictError("invalid_transition", "This order can't move to that step.")` unless `canTransition`; on `CANCELED` sets cancel fields and calls `releaseStock` (mode from `releaseMode`) for `HELD` reservations, marking them `RELEASED`/`WRITTEN_OFF`; on `HANDED_TO_COURIER` calls `consumeStock` and marks `CONSUMED`; writes history; re-derives and stores the order status.
  - `systemAdvance(db, partId, to: "HANDED_TO_COURIER" | "FULFILLED"): Promise<void>` — for Phase 7 and tests only.
  - shopper: `listShopperOrders(db, userId): Promise<OrderSummary[]>` (`{ createdAt; number; partStatuses: FulfilmentStatus[]; status; totalPaise }`, newest first); `getShopperOrder(db, userId, number): Promise<OrderView>` (`NotFoundError("Order not found.")`); `cancelShopperOrder(db, userId, number, input): Promise<OrderView>` — one part by number, or every part not yet `FULFILLED`/`CANCELED`; none left → `invalid_transition`.
  - merchant: `MerchantOrderSummary { createdAt; id; itemCount; itemsSummary: string; number; paymentMethod; status; totalPaise }`; `listMerchantOrders(db, ctx, { page: number; status?: FulfilmentStatus }): Promise<{ items: MerchantOrderSummary[]; total: number }>` (25 per page, newest first); `MerchantOrderView { address: AddressSnapshot; canceledBy: ActorRole | null; cancelNote: null | string; cancelReason: MakerCancelReason | null; codAmountPaise; createdAt; history: { actorRole; at; from; note; reason; to }[]; id; items: (OrderItemView & { sku: string })[]; number; paymentMethod; status; totalPaise }`; `getMerchantOrder(db, ctx, id)` (another shop's → 404); `advanceMerchantOrder(db, ctx, id, to)`; `cancelMerchantOrder(db, ctx, id, { note?, reason })`; `countMerchantOrders(db, merchantId): Promise<{ newOrders: number; toPack: number }>` (`NEW`; `ACKNOWLEDGED` + `PACKING`).
  - Routes per spec §10; merchant routes `authorizeApprovedMerchant()`; `GET /merchant/orders` query `status` (fulfilment status) and `page` via `parseQuery`.

- [ ] **Step 1: Write the failing tests.** Maker walks NEW→ACKNOWLEDGED→PACKING→READY_FOR_PICKUP, order status `PROCESSING`, four history rows; skipping a step → `invalid_transition`; maker cancel `OUT_OF_STOCK` → part `CANCELED`, reservation `WRITTEN_OFF`, `available` unchanged, `reserved` down; maker cancel `CANNOT_FULFIL` → `RELEASED`, `available` back; shopper cancel of part B leaves part A `NEW`, order `CONFIRMED`; shopper cancel of all → order `CANCELED`; cancel after `FULFILLED` (via `systemAdvance`) → `invalid_transition`; `HANDED_TO_COURIER` → reservation `CONSUMED`, `reserved` down; one fulfilled + one cancelled → `COMPLETED`; **concurrent shopper cancel and maker cancel of one part** → one succeeds, one `invalid_transition`, stock moved once; maker sees only own parts in list, detail of another shop's part → 404; shopper's other user number → 404; counts. E2E API: signed-out `GET /api/v1/orders` → 401; non-merchant `GET /api/v1/merchant/orders` → 403.
- [ ] **Step 2: Run** `bun run test:integration -- tests/integration/orders/fulfilment.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** same + `bun run test:e2e -- tests/e2e/orders-api.spec.ts` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(orders): order history, cancellation and maker steps with API`

---

### Task 7: Checkout page

**Files:**
- Modify: `src/app/(site)/(store)/checkout/page.tsx`, `src/css/gillu-store.css`, `tests/e2e/cart-checkout.spec.ts` (Phase 4 "Place order disabled" assertions now expect the real checkout)
- Create: `src/ui/gillu/store/{checkout-form,address-form}.client.tsx`
- Test: `tests/e2e/checkout.spec.ts`

**Interfaces:**
- Consumes: `getCart`, `listAddresses`, `POST /api/v1/account/addresses`, `POST /api/v1/orders`.
- Produces:
  - Page (server): `requireSession("/checkout")`; empty cart → `/cart`; renders `CheckoutForm` with the cart view, addresses and a `checkoutKey` (`crypto.randomUUID()` per render).
  - `AddressForm({ onSaved })` (client): fields `#fullName` "Full name", `#phone` "Mobile number", `#line1` "Address line 1", `#line2` "Address line 2 (optional)", `#landmark` "Landmark (optional)", `#city` "City", `#state` "State" (select), `#postalCode` "PIN code", checkbox "Make this my default address"; field errors under each field (`<id>-error`); "Save address".
  - `CheckoutForm` sections in spec §7 order: "Your items" with "Parcel N of M · <store>" headings; "Deliver to" radios (label: name, line 1, city, PIN) and "Add a new address"; "Payment" radios "Cash on delivery" (checked) and "Pay online" (disabled) + "Coming soon"; multi-parcel COD note exactly "Your order comes in N parcels. Pay each one when it arrives: ₹A to <store>, ₹B to <store>." (comma-separated, " and " not used); summary "Items ₹X", "Delivery Free", "Total ₹X"; "Place order" (disabled while sending or without an address or when any line is not ok). Success → `router.push("/orders/<number>?placed=1")`; error → API message in `role="alert"`, plus "Back to cart" link for `cart_needs_attention` / `price_changed` / `insufficient_stock`.

- [ ] **Step 1: Write the failing E2E:** shopper with items from two shops opens `/checkout`, no address → the form is open; bad PIN shows `#postalCode-error`; saves an address → selected; sees "Parcel 1 of 2 · <A>" and the COD note with both amounts; "Pay online" disabled; double-clicks "Place order" → lands on `/orders/GIL-…`; `GET /api/v1/orders` lists exactly one order; cart badge gone.
- [ ] **Step 2: Run** `bun run test:e2e -- tests/e2e/checkout.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** Update `cart-checkout.spec.ts`: after sign-up it lands on `/checkout` with the same items and an enabled path to place the order (assert the "Deliver to" heading instead of the Phase 4 disabled button).
- [ ] **Step 4: Run** same + `tests/e2e/cart-checkout.spec.ts` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(store): checkout with delivery address and cash on delivery`

---

### Task 8: Shopper order pages, addresses page, header

**Files:**
- Create: `src/app/(site)/(store)/orders/page.tsx`, `src/app/(site)/(store)/orders/[number]/page.tsx`, `src/app/(site)/(store)/account/addresses/page.tsx`, `src/ui/gillu/store/{order-parcels.client,address-list.client}.tsx`, `src/ui/gillu/store/order-status.tsx`
- Modify: `src/ui/gillu/site/site-header.client.tsx`, `src/css/gillu-store.css`
- Test: `tests/e2e/shopper-orders.spec.ts`

**Interfaces:**
- Produces:
  - `/orders/[number]` (`requireSession`; `getShopperOrder`; 404 via `notFound()`): with `?placed=1` the heading "Thank you — your order GIL-1001 is placed."; otherwise `h1` "Order GIL-1001"; "Deliver to" snapshot; "Payment: Cash on delivery"; per parcel: store (link only when `shopLinkable`), number, `SHOPPER_STATUS_TEXT`, items, "Pay ₹X on delivery" (COD, not cancelled), maker cancel reason "Cancelled by <store>: <MAKER_CANCEL_TEXT>" + note; "Cancel this parcel" per open parcel and "Cancel order" when ≥ 2 open, each with an inline confirm "Yes, cancel" / "Keep it"; after cancel `router.refresh()`.
  - `/orders` "My orders": rows (number link, date `en-IN`, total, parcel statuses); empty "No orders yet." + "Explore Gillu"; a "Your addresses" link to `/account/addresses`.
  - `/account/addresses` "Your addresses": list with "Default" tag, "Make default", "Edit", "Delete", and `AddressForm` to add.
  - Site header (desktop + mobile menu), with `useSession()` from `~/lib/auth-client`: signed in → links "My orders" (`/orders`) and button "Sign out" (`signOut()` then `router.push("/")` + `router.refresh()`); signed out → "Sign in" (today's link).
  - `metadata.robots = { index: false }` on all three pages.

- [ ] **Step 1: Write the failing E2E:** placed order shows thank-you, both parcels and "Pay ₹349 on delivery"; `/orders` lists it; cancel parcel B → B shows "Cancelled", A unchanged; another shopper opening the number → 404; addresses page adds, sets default, deletes; header "Sign out" signs out and shows "Sign in".
- [ ] **Step 2: Run** `bun run test:e2e -- tests/e2e/shopper-orders.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** same + `tests/e2e/landing.spec.ts tests/e2e/explore.spec.ts` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(store): my orders, order page with cancel, addresses and sign out`

---

### Task 9: Merchant orders in the desk, desk sign-out

**Files:**
- Create: `src/app/merchant/orders/page.tsx`, `src/app/merchant/orders/[id]/page.tsx`, `src/ui/gillu/desk/{merchant-order-actions,sign-out}.client.tsx`
- Modify: `src/ui/gillu/desk/desk-shell.tsx` (nav item "Orders" → `/merchant/orders`, icon `box`, approved shops only), `src/ui/gillu/desk/desk-nav.client.tsx` (`DeskNavItem.badge?: number`; render `<span className="nav-badge">N</span>` when > 0; "Sign out" in the sidebar footer and mobile menu), `src/app/merchant/layout.tsx` (passes `countMerchantOrders` for approved shops), `src/app/merchant/dashboard/page.tsx` (metrics "New orders" and "Orders to pack"), `src/ui/gillu/desk/variants-table.client.tsx` ("N held for orders" when `reserved > 0`), `src/css/gillu-desk.css`
- Test: `tests/e2e/merchant-orders.spec.ts`

**Interfaces:**
- Produces:
  - `/merchant/orders` (`requireApprovedMerchant("/merchant/orders")`): heading "Orders"; tabs (links with `?status=`) "New", "Preparing", "Packing", "Packed", "Cancelled", "All"; table: number (link to `/merchant/orders/<id>`), date, items summary, total, "Cash on delivery", `MAKER_STATUS_TEXT`; empty "No orders here yet."; pagination 25.
  - `/merchant/orders/[id]`: `h1` number; placed time; items table (product, size, SKU, quantity, price); "Total ₹X"; "Cash on delivery: collect ₹X"; "Deliver to" (name, mobile, address, PIN); "History" list; the next-step button for the current status ("Start preparing", "Start packing", "Mark packed"); "Cancel order" opening a form with radios from `MAKER_CANCEL_TEXT` and `#cancelNote`; a cancelled part shows "Cancelled: <reason>" and no actions; another shop's id → 404.
  - `SignOutButton` (client): "Sign out" → `signOut()` → `router.push("/")`; rendered for every desk page, including draft/submitted shops.

- [ ] **Step 1: Write the failing E2E** (two approved makers A and B, a shopper order with both): A sees nav badge "1" and overview "New orders 1"; A opens the part: delivery details present, B's product name absent; "Start preparing" → "Start packing" → "Mark packed" → status "Packed — waiting for pickup", badge gone; B cancels with "Out of stock" → shopper's order page shows "Cancelled by <B>: Out of stock"; B's product variant shows 0 held and stock unchanged; A's product shows "1 held for orders"; shopper cancels A's parcel → A's held stock is 0 and the product is purchasable again (`GET /api/v1/shops/<A>/products/<slug>` 200); B opening A's part URL → 404; desk "Sign out" lands on `/` signed out; a draft merchant also sees "Sign out".
- [ ] **Step 2: Run** `bun run test:e2e -- tests/e2e/merchant-orders.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** same + `tests/e2e/desk.spec.ts tests/e2e/merchant-products.spec.ts` + `bunx knip` — Expected: PASS / clean.
- [ ] **Step 5: Commit** `feat(merchant): orders in the desk with steps, cancel and sign out`

---

### Task 10: Docs, tracker, full gate and Compose smoke

**Files:**
- Modify: `docs/architecture.md` (orders module), `docs/database-design.md` (0006, ER), `docs/api-contracts.md` (addresses, orders, merchant orders, new error codes `cart_empty`, `cart_needs_attention`, `price_changed`, `payment_method_unavailable`, `invalid_transition`, `address_limit`), `docs/merchant-workflow.md` (orders), `docs/testing.md`, `diagrams/decisions.md` (ADR-035 one order with a part per maker and derived order status; ADR-036 stock reservation with release and write-off; ADR-037 checkout-key idempotency, outbox and `idempotency_keys` deferred to Phase 6), `diagrams/implementation-progress.md` (Phase 5 COMPLETED with checkboxes, Verification table, Phase 5 report §29 format; Current Phase → Phase 6)
- Test: full gate

- [ ] **Step 1:** Gate, each to a log in the plan workspace: `bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test:unit`, `bun run test:integration`, `bun run test:e2e`. Expected: all exit 0; record counts.
- [ ] **Step 2:** Compose smoke as Phase 4 (project `gillu-smoke`, port 18080, renamed containers, throwaway env in the scratchpad): `migrate` exit 0; `drizzle.__drizzle_migrations` 7 rows; `orders`, `merchant_orders`, `order_items`, `customer_addresses`, `inventory_reservations` exist; `GET /` 200; `POST /api/v1/orders` without a session → 401 JSON with `requestId`; `GET /api/v1/merchant/orders` without a session → 401. Then `down -v` for `gillu-smoke` only; confirm `gillu_*` and `relivator_postgres_data` volumes remain.
- [ ] **Step 3:** Write the docs and tracker with the real numbers.
- [ ] **Step 4:** Read the docs once for accuracy against the code (Biome does not lint Markdown — Phase 4 ruling).
- [ ] **Step 5: Commit** `docs: Phase 5 order system report`
