# Gillu Phase 5 — Internal Order System — Design

Status: draft for review, 2026-10-28. Builds on `gillu/phase-4` (Phase 4 COMPLETED).
Requirements: `diagrams/implementation-prompt.txt` §11 (multi-merchant orders),
§12 (checkout rules), §13 (pricing snapshots), §14 (merchant fulfilment), §16
(COD), §18 (order states), §19 (merchant dashboard), §26 Phase 5, §29.
Parent design: `docs/superpowers/specs/2026-10-27-gillu-marketplace-design.md`
(C4 order numbers, C5 money, §5.3 module rules, §6 data plan).

## 1. Intent

A signed-in shopper turns their cart into a real order: they pick a delivery
address, choose Cash on delivery, and press "Place order". Gillu's database
records one order for the shopper and one part per maker. Each maker sees only
their part in the dashboard, with the delivery details they need, and moves it
through preparing and packing. Stock is held the moment the order is placed so
two shoppers can never buy the last piece.

Phase 5 deliverable (§26): a customer can place an internal order without an
external payment provider. Cash on delivery is that order: Gillu takes no
money at checkout; Shiprocket collects at the door (Phase 7).

## 2. Goals, non-goals, anti-goals

Goals
- Checkout with a saved or new Indian delivery address and payment method
  Cash on delivery; one order, split into one part per maker.
- Prices, purchasability and stock re-checked on the server at placement;
  prices snapshotted on the order.
- Stock reserved atomically at placement; released when a part is cancelled
  before pickup.
- Pressing "Place order" twice, or two tabs, never creates two orders.
- Makers see a "New orders" count and an orders list, open an order, see the
  delivery details, and move it to preparing → packing → packed.
- Shoppers see their orders and each part's status, and can cancel.
- Makers can cancel their part with a reason the shopper sees.
- Sign out in the merchant dashboard, and sign out plus "My orders" for shoppers.

Non-goals (later phases)
- Online payment (Cashfree) — Phase 6. "Pay online" is shown but not selectable.
- Shiprocket: shipments, labels, pickup, tracking, delivery, COD collection and
  remittance, PIN-code serviceability — Phase 7.
- WhatsApp, email or SMS alerts; unacknowledged-order and delayed-dispatch
  alerts; merchant availability settings; admin escalation — later (Phase 8).
- Refunds, returns, commissions, merchant payouts, fee settings.
- Shopper reviews — Phase 8.

Anti-goals (a failure even if it works)
- Two orders from one press, or a part with someone else's items.
- Stock below zero, or the last piece sold twice.
- A shopper charged or quoted a price different from what they saw at
  "Place order"; a delivery charge appearing after placement.
- A COD order shown or stored as PAID or PREPAID at placement (§16).
- A maker seeing another maker's items, prices or the shopper's other parts.
- An "accept order" step needed before the order exists (§14).

## 3. Decisions made with the user (2026-10-28)

1. **Flow:** sign in → delivery address → payment method → "Place order" →
   the order is in the database → each maker gets their part → preparing →
   packing → picked up by Shiprocket → delivered to the shopper.
2. **Payment methods:** COD and Prepaid. Prepaid goes through Cashfree (Phase
   6); COD is collected by Shiprocket at delivery (Phase 7).
3. **Multi-maker:** each maker gets their own part of the order and ships it
   separately with its own status.
4. **Delivery is free for the shopper.** The seller bears the shipping cost.
5. **Cancellation:** the shopper can cancel at any point before delivery; the
   maker can also cancel.
6. **Notifications:** a "New orders" count in the merchant dashboard is enough
   for now; WhatsApp alerts later.
7. **Addresses:** fields as in §6, India only, several saved addresses with a
   default; each order keeps its own copy.
8. **Merchant dashboard sign-out** is missing and is added in this phase.

## 4. Order model

One **order** (parent) per placement, one **merchant order** (part) per maker
in it, one **order item** per cart line.

- Order number from a Postgres sequence: `GIL-1001`, `GIL-1002`, … (parent
  design C4; the sequence starts at 1001). Parts are `GIL-1001-A`,
  `GIL-1001-B`, … lettered in the order the makers first appear in the cart.
- Order items snapshot: product name, variant label, SKU, unit price paise,
  declared MRP paise, quantity, line total, cover image URL, product and
  variant ids (nullable links; the snapshot stands if the product changes).
- A part stores its maker, subtotal, delivery charge (always 0 in Phase 5),
  payable total, and for COD `cod_amount_paise` = its payable total. The
  order's payable total equals the sum of its parts (§12).
- Pricing fields per requirements §13 are stored where known now (item price
  snapshot, MRP snapshot); courier estimate, actual courier charge and payment
  or COD fees are nullable columns for Phases 6–7, never invented.

### 4.1 States (requirements §18 names, exactly)

Order status: `PENDING_PAYMENT`, `CONFIRMED`, `PROCESSING`,
`PARTIALLY_FULFILLED`, `COMPLETED`, `CANCELED`.
Payment status: `UNPAID`, `PENDING`, `PAID`, `FAILED`, `REFUND_PENDING`,
`REFUNDED`. Payment method: `PREPAID`, `COD`.
Fulfilment status (on each part): `NEW`, `ACKNOWLEDGED`, `PACKING`,
`READY_FOR_PICKUP`, `HANDED_TO_COURIER`, `FULFILLED`, `CANCELED`.
Shipment status belongs to Phase 7 and is not built here.

Shopper and maker words for fulfilment status:

| Status | Maker sees | Shopper sees |
|---|---|---|
| `NEW` | New | Order placed |
| `ACKNOWLEDGED` | Preparing | Being prepared |
| `PACKING` | Packing | Being packed |
| `READY_FOR_PICKUP` | Packed — waiting for pickup | Packed |
| `HANDED_TO_COURIER` | Picked up | On its way |
| `FULFILLED` | Delivered | Delivered |
| `CANCELED` | Cancelled | Cancelled |

### 4.2 Transitions

Maker (dashboard buttons): `NEW → ACKNOWLEDGED` ("Start preparing"),
`ACKNOWLEDGED → PACKING` ("Start packing"), `PACKING → READY_FOR_PICKUP`
("Mark packed"). `HANDED_TO_COURIER` and `FULFILLED` are set only by the
shipping integration (Phase 7); in Phase 5 they are reachable only from test
code through the same service, so the rules are tested now.

Cancel: shopper or maker, from any status before `FULFILLED`. A maker cancel
needs a reason: `OUT_OF_STOCK`, `DAMAGED`, `CANNOT_FULFIL`, `OTHER` (with a note
for `OTHER`, ≤ 300 characters); the shopper sees the reason. A shopper cancel
takes an optional reason. A cancelled part never changes again.

Every other transition is refused (`409 invalid_transition`). Every accepted
transition writes a status history row (from, to, actor user id, actor role
shopper | merchant | system, reason, note, time) in the same transaction.

Order status is derived from its parts after every change, in the same
transaction:
- all parts `CANCELED` → `CANCELED`;
- every non-cancelled part `FULFILLED` → `COMPLETED`;
- some parts `FULFILLED` → `PARTIALLY_FULFILLED`;
- any part past `NEW` → `PROCESSING`;
- otherwise `CONFIRMED`.
A COD order is `CONFIRMED` at placement with payment status `UNPAID` (§16).
`PENDING_PAYMENT` is used by Prepaid in Phase 6.

## 5. Stock

Placement reserves every line inside the order transaction with one guarded
update per variant (parent design §6): `available = available - q, reserved =
reserved + q WHERE variant_id = v AND available >= q`. Zero rows → the whole
order rolls back with `409 insufficient_stock` naming the item. Variants are
updated in a fixed order (variant id) so concurrent orders cannot deadlock.

Each reserved line gets an `inventory_reservations` row (order item, variant,
quantity, status `HELD` | `RELEASED` | `WRITTEN_OFF` | `CONSUMED`). The
`inventory_movements` log keeps recording changes to `available` only (its
`delta ≠ 0` CHECK stays): new reasons `ORDER_RESERVED` (−q) and
`ORDER_RELEASED` (+q), added to the enum additively. Changes to `reserved`
alone are recorded by the reservation's status.

- Cancel before `HANDED_TO_COURIER` by the shopper, or by the maker with
  reason `CANNOT_FULFIL` or `OTHER`: `reserved -= q, available += q`,
  reservation `RELEASED`, movement `ORDER_RELEASED`. The items are on sale again.
- Cancel before `HANDED_TO_COURIER` by the maker with reason `OUT_OF_STOCK` or
  `DAMAGED` (decided with the user): `reserved -= q` only, reservation
  `WRITTEN_OFF`. Those pieces do not exist, so they do not go back on sale.
- `HANDED_TO_COURIER` (Phase 7): `reserved -= q`, reservation `CONSUMED`.
  The stock has left the shop.
- Cancel after pickup: nothing returns automatically; the return parcel is
  Phase 7's.

Merchant stock adjustments (ADR-030) keep working on `available` only; the
desk shows "N held for orders" next to available stock.

## 6. Addresses

Shopper addresses (`customer_addresses`, owned by the user):
full name (2–80), mobile (10-digit Indian, stored `+91…`, the merchant phone
rules), line 1 (required), line 2 (optional), landmark (optional, ≤ 80), city,
state (from `INDIAN_STATES`), PIN code (`^[1-9][0-9]{5}$`). Reuse the merchant
address and phone validation; errors show under each field (the Phase 2
highlight fix). India only. Up to 10 saved; one `is_default` (partial unique
index). Deleting a saved address never touches past orders.

Each order stores a copy of the address as placed (`order_address_snapshots`).
Makers see the snapshot of their part's order: name, mobile and full address —
what they need to pack and hand over (§19). Phase 7 copies it to Shiprocket.

## 7. Checkout and placing an order

`/checkout` (Phase 4 entry point, signed-in only) becomes the real checkout:

1. **Your items** — the cart's groups, read-only, each headed by the maker:
   "Parcel 1 of 2 · Goa Kitchen". Any line not `ok` → "Some items need
   attention" + "Back to cart"; "Place order" stays disabled.
2. **Deliver to** — saved addresses as radios (default first) and "Add a new
   address" (inline form; saved to the shopper's addresses). No saved address →
   the form opens.
3. **Payment** — "Cash on delivery" (selected) and "Pay online" disabled with
   "Coming soon". For COD with more than one parcel: "Your order comes in N
   parcels. Pay each one when it arrives: ₹A to Goa Kitchen, ₹B to Jaipur
   Clay." (§12).
4. **Summary** — items total, "Delivery: Free", total to pay.
5. **"Place order"** — sends the address id, payment method `COD`, the
   checkout key, and the totals the shopper saw.

`POST /api/v1/orders` (session required) in one transaction:
- lock the shopper's cart; read it through the cart service;
- refuse unless every line is `ok` (`409 cart_needs_attention`) and the cart is
  not empty (`409 cart_empty`);
- refuse if the server total differs from the total the shopper saw
  (`409 price_changed`, the cart then shows the change);
- refuse an address that is not the shopper's (404) and `PREPAID`
  (`409 payment_method_unavailable`);
- reserve stock (§5); create the order, parts, items, address snapshot,
  reservations and history; derive statuses;
- remove the ordered lines from the cart;
- answer `201` with the order number. The page goes to `/orders/GIL-1001`.

**Idempotency:** the checkout page carries a random checkout key, kept for the
page's life. The order has a unique `(user_id, checkout_key)`. A repeat
`POST` with the same key returns the existing order (`200`, same body) instead
of creating one; the key from a different user is just a different key. The
button disables while the request is in flight.

Prepaid checkout, PIN-code serviceability and COD eligibility limits come in
Phases 6–7; nothing here blocks adding them before the reservation step.

## 8. Shopper pages

- `/orders/[number]` — confirmation and detail: "Thank you — your order
  GIL-1001 is placed." (first view after placing), address, payment method
  "Cash on delivery", each parcel with its maker, items, amount to pay on
  delivery, status in the shopper's words (§4.1) and the maker's cancel reason
  if any. "Cancel this parcel" per part and "Cancel order" (all open parts),
  with a confirmation step. Only the order's owner can open it (404 otherwise).
- `/orders` — "My orders": newest first, number, date, parcels' statuses, total.
- `/account/addresses` — list, add, edit, delete, set default.
- Gillu site header: when signed in, "My orders" and "Sign out"; when signed
  out, "Sign in". Sign out returns to `/`.

## 9. Merchant dashboard

- Navigation gains **Orders** with the count of `NEW` parts as a badge; the
  overview's "New orders" and "Orders to pack" (`ACKNOWLEDGED` + `PACKING`)
  metrics use real counts (§19). Approved shops only, like products.
- `/merchant/orders` — the shop's parts, newest first: part number, date,
  items summary, total, payment method, status; filter tabs New / Preparing /
  Packing / Packed / Cancelled / All.
- `/merchant/orders/[id]` — part number, placed time, items with SKU, variant
  and quantity, part total, "Cash on delivery: collect ₹X", delivery details
  (name, mobile, address), status history, the next-step button (§4.2), and
  "Cancel order" with the reason picker. Another shop's part → 404.
- Owner and staff can both work orders; a suspended shop cannot (403, as
  products).
- **Sign out** in the dashboard menu (desktop and mobile) for every merchant
  page, including draft and submitted shops. Sign out returns to `/`.

## 10. API (`/api/v1`, ADR-022 contract, `no-store`)

| Method & path | Who | Notes |
|---|---|---|
| `GET /account/addresses`, `POST /account/addresses` | shopper | max 10 → `409 address_limit` |
| `PATCH`, `DELETE /account/addresses/{id}` | shopper | other user's id → 404 |
| `POST /orders` | shopper | §7; `201` new, `200` repeat key |
| `GET /orders`, `GET /orders/{number}` | shopper | own orders only |
| `POST /orders/{number}/cancel` | shopper | body `{ merchantOrder?: "GIL-1001-A", reason? }`; no part → every open part |
| `GET /merchant/orders`, `GET /merchant/orders/{id}` | approved merchant | own parts only |
| `POST /merchant/orders/{id}/status` | approved merchant | `{ to: "ACKNOWLEDGED" \| "PACKING" \| "READY_FOR_PICKUP" }` |
| `POST /merchant/orders/{id}/cancel` | approved merchant | `{ reason, note? }` |

New error codes: `cart_empty`, `cart_needs_attention`, `price_changed`,
`payment_method_unavailable`, `invalid_transition`, `address_limit`, plus
`insufficient_stock` (existing) at placement.

## 11. Data (migration 0006, additive only)

New tables per parent design §6 Phase 5 that this phase uses:
`customer_addresses`, `orders`, `merchant_orders`, `order_items`,
`order_address_snapshots`, `order_status_history`, `inventory_reservations`.
New enums: order status, payment status, payment method, fulfilment status,
reservation status, maker cancel reason, actor role. New
`inventory_movement_reason` values (§5). Sequence `order_number_seq` starting
at 1001. Money in `bigint` paise with `CHECK (>= 0)`; quantities `CHECK > 0`.

Unique: `orders.number`, `merchant_orders.number`, `(user_id, checkout_key)`,
`(order_id, merchant_id)` on parts, one default address per user.

Not built in Phase 5 (no consumer yet): `idempotency_keys` (the order's unique
checkout key covers placement), `outbox_events`, `background_job_attempts`,
the outbox dispatcher service, `merchant_fee_settings`, `merchant_payables`.
They arrive with Phases 6–7, which make the first external calls.

Modules: a new `orders` module owns orders, parts, items, snapshots, history
and the checkout service; the `inventory` rules for reserve/release live in the
catalog module (which owns `inventory`) behind a public function the orders
service calls inside its transaction; addresses live in a small `customers`
area of the orders module. Cart lines are removed through the cart module.

## 12. Testing and verification

- Unit: transition table (every allowed and refused pair), order status
  derivation, part lettering, COD split sums, address schema.
- Integration (Testcontainers): placement creates order, parts, items,
  snapshots, reservations and history; stock moves `available → reserved`;
  repeat checkout key returns the same order; **concurrent placements for the
  last unit — exactly one succeeds, stock never negative** (Scenario H);
  price changed, line not ok, empty cart, other user's address, PREPAID
  refused; cancel before pickup releases stock; shopper cancel of one part
  leaves the other; maker cancel needs a reason; invalid transitions refused;
  maker sees only own parts; order status derivation after each change.
- E2E: shopper with items from two makers adds an address, sees the two-parcel
  COD note, places the order, lands on `GIL-…`, sees two parcels; double-click
  "Place order" makes one order; maker A sees "New orders 1", opens the part
  (delivery details shown, maker B's items absent), moves it to Packed; maker B
  cancels with "Out of stock" and the shopper sees the reason; shopper cancels
  the remaining part and stock is back on sale; merchant and shopper sign out.
- Gate and Compose smoke as Phase 4 (project `gillu-smoke`): 7 migrations, new
  tables exist, `POST /api/v1/orders` without a session → 401 JSON.

## 13. Constraints carried from earlier phases

Migrations additive only; never touch `relivator_postgres_data` or the `gillu`
Compose stack; money in integer paise; every route authorizes itself;
merchant-scoped queries take the merchant from the membership; module writes
only its own tables; Phase 2–4 E2E ids and copy keep working; no fake data.

## 14. Calls made while writing (not discussed with the user — check these)

- Prepaid is visible but disabled ("Coming soon") until Phase 6.
- Maker buttons stop at "Packed"; pickup and delivery come only from Phase 7.
- Shopper can cancel one parcel or the whole order; maker cancel needs a reason.
- A part whose shop is suspended after placement stays as it is: the maker can
  no longer work it, and the shopper can still cancel it. Admin handling later.
- A maker may buy from their own shop like any shopper (no special rule).
- No admin order pages in Phase 5; support reads the database.
- Up to 10 saved addresses per shopper.
- Order numbers start at `GIL-1001`.
- Outbox, idempotency-key table, fee and payable tables wait for Phases 6–7.
- PIN-code serviceability (§12) needs Shiprocket, so Phase 5 accepts any valid
  Indian PIN code.

## 15. Left to the builder

File layout inside the `orders` module, component composition, exact desk
table styling within the Gillu desk CSS, pagination of order lists (25 per
page is fine), wording of confirmation dialogs, and test fixture shape.

## 16. Open inputs (not blocking Phase 5)

- Cashfree sandbox credentials (Phase 6); Shiprocket sandbox login (Phase 7).
- Acknowledgement and dispatch deadlines and alert channels (later phase).
- Commission, fees and payouts (deferred ADRs).
