import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import {
  ACTOR_ROLES,
  FULFILMENT_STATUSES,
  MAKER_CANCEL_REASONS,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  RESERVATION_STATUSES,
} from "../../../modules/orders/domain/statuses";
import { productsTable, productVariantsTable } from "../catalog/tables";
import { merchantsTable } from "../merchants/tables";
import { userTable } from "../users/tables";

export const orderStatusEnum = pgEnum("order_status", ORDER_STATUSES);
export const paymentStatusEnum = pgEnum("payment_status", PAYMENT_STATUSES);
export const paymentMethodEnum = pgEnum("payment_method", PAYMENT_METHODS);
export const fulfilmentStatusEnum = pgEnum(
  "fulfilment_status",
  FULFILMENT_STATUSES,
);
export const reservationStatusEnum = pgEnum(
  "reservation_status",
  RESERVATION_STATUSES,
);
export const makerCancelReasonEnum = pgEnum(
  "maker_cancel_reason",
  MAKER_CANCEL_REASONS,
);
export const actorRoleEnum = pgEnum("actor_role", ACTOR_ROLES);

/** GIL-1001, GIL-1002, … (parent design C4). */
export const orderNumberSeq = pgSequence("order_number_seq", {
  startWith: 1001,
});

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull();
const paise = (name: string) => bigint(name, { mode: "number" });

/** Address fields shared by saved addresses and order snapshots. */
const addressColumns = () => ({
  city: text("city").notNull(),
  fullName: text("full_name").notNull(),
  landmark: text("landmark"),
  line1: text("line1").notNull(),
  line2: text("line2"),
  phone: text("phone").notNull(),
  postalCode: text("postal_code").notNull(),
  state: text("state").notNull(),
});

/** A shopper's saved delivery address. */
export const customerAddressesTable = pgTable(
  "customer_addresses",
  {
    ...addressColumns(),
    createdAt: createdAt(),
    id: text("id").primaryKey(),
    isDefault: boolean("is_default").default(false).notNull(),
    updatedAt: updatedAt(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("customer_addresses_user_id_idx").on(table.userId),
    uniqueIndex("customer_addresses_one_default")
      .on(table.userId)
      .where(sql`${table.isDefault}`),
    check(
      "customer_addresses_postal_code",
      sql`${table.postalCode} ~ '^[1-9][0-9]{5}$'`,
    ),
  ],
);

/** One placement by a shopper; split into one part per maker. */
export const ordersTable = pgTable(
  "orders",
  {
    checkoutKey: text("checkout_key").notNull(),
    createdAt: createdAt(),
    deliveryPaise: paise("delivery_paise").default(0).notNull(),
    id: text("id").primaryKey(),
    itemsTotalPaise: paise("items_total_paise").notNull(),
    number: text("number").notNull().unique(),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    paymentStatus: paymentStatusEnum("payment_status").notNull(),
    status: orderStatusEnum("status").notNull(),
    totalPaise: paise("total_paise").notNull(),
    updatedAt: updatedAt(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "restrict" }),
  },
  (table) => [
    unique("orders_user_checkout_key_unique").on(
      table.userId,
      table.checkoutKey,
    ),
    index("orders_user_id_idx").on(table.userId),
    check(
      "orders_money_non_negative",
      sql`${table.itemsTotalPaise} >= 0 AND ${table.deliveryPaise} >= 0 AND ${table.totalPaise} >= 0`,
    ),
  ],
);

/** One maker's part of an order, shipped on its own. */
export const merchantOrdersTable = pgTable(
  "merchant_orders",
  {
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    canceledBy: actorRoleEnum("canceled_by"),
    cancelNote: text("cancel_note"),
    cancelReason: makerCancelReasonEnum("cancel_reason"),
    codAmountPaise: paise("cod_amount_paise"),
    // Known from Phases 6-7; never invented before.
    courierChargePaise: paise("courier_charge_paise"),
    courierEstimatePaise: paise("courier_estimate_paise"),
    createdAt: createdAt(),
    deliveryPaise: paise("delivery_paise").default(0).notNull(),
    fulfilmentStatus: fulfilmentStatusEnum("fulfilment_status")
      .default("NEW")
      .notNull(),
    id: text("id").primaryKey(),
    itemsTotalPaise: paise("items_total_paise").notNull(),
    merchantId: text("merchant_id")
      .notNull()
      .references(() => merchantsTable.id, { onDelete: "restrict" }),
    number: text("number").notNull().unique(),
    orderId: text("order_id")
      .notNull()
      .references(() => ordersTable.id, { onDelete: "cascade" }),
    paymentFeePaise: paise("payment_fee_paise"),
    totalPaise: paise("total_paise").notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("merchant_orders_order_merchant_unique").on(
      table.orderId,
      table.merchantId,
    ),
    index("merchant_orders_merchant_status_idx").on(
      table.merchantId,
      table.fulfilmentStatus,
    ),
    check(
      "merchant_orders_money_non_negative",
      sql`${table.itemsTotalPaise} >= 0 AND ${table.deliveryPaise} >= 0 AND ${table.totalPaise} >= 0
        AND coalesce(${table.codAmountPaise}, 0) >= 0
        AND coalesce(${table.courierChargePaise}, 0) >= 0
        AND coalesce(${table.courierEstimatePaise}, 0) >= 0
        AND coalesce(${table.paymentFeePaise}, 0) >= 0`,
    ),
  ],
);

/** A line of an order, with the product as it was sold. */
export const orderItemsTable = pgTable(
  "order_items",
  {
    coverImageUrl: text("cover_image_url"),
    createdAt: createdAt(),
    declaredMrpPaise: paise("declared_mrp_paise"),
    id: text("id").primaryKey(),
    lineTotalPaise: paise("line_total_paise").notNull(),
    merchantOrderId: text("merchant_order_id")
      .notNull()
      .references(() => merchantOrdersTable.id, { onDelete: "cascade" }),
    productId: text("product_id").references(() => productsTable.id, {
      onDelete: "set null",
    }),
    productName: text("product_name").notNull(),
    productSlug: text("product_slug").notNull(),
    quantity: integer("quantity").notNull(),
    sku: text("sku").notNull(),
    unitPricePaise: paise("unit_price_paise").notNull(),
    variantId: text("variant_id").references(() => productVariantsTable.id, {
      onDelete: "set null",
    }),
    variantLabel: text("variant_label"),
  },
  (table) => [
    index("order_items_merchant_order_id_idx").on(table.merchantOrderId),
    check("order_items_quantity_positive", sql`${table.quantity} > 0`),
    check(
      "order_items_money_non_negative",
      sql`${table.unitPricePaise} >= 0 AND ${table.lineTotalPaise} >= 0 AND coalesce(${table.declaredMrpPaise}, 0) >= 0`,
    ),
  ],
);

/** The delivery address as it was when the order was placed. */
export const orderAddressSnapshotsTable = pgTable("order_address_snapshots", {
  ...addressColumns(),
  createdAt: createdAt(),
  orderId: text("order_id")
    .primaryKey()
    .references(() => ordersTable.id, { onDelete: "cascade" }),
});

/** Every accepted change of a part's status. */
export const orderStatusHistoryTable = pgTable(
  "order_status_history",
  {
    actorRole: actorRoleEnum("actor_role").notNull(),
    actorUserId: text("actor_user_id").references(() => userTable.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    fromStatus: fulfilmentStatusEnum("from_status"),
    id: text("id").primaryKey(),
    merchantOrderId: text("merchant_order_id")
      .notNull()
      .references(() => merchantOrdersTable.id, { onDelete: "cascade" }),
    note: text("note"),
    reason: text("reason"),
    toStatus: fulfilmentStatusEnum("to_status").notNull(),
  },
  (table) => [
    index("order_status_history_merchant_order_id_idx").on(
      table.merchantOrderId,
    ),
  ],
);

/** Stock held for one order item until it ships or is cancelled. */
export const inventoryReservationsTable = pgTable(
  "inventory_reservations",
  {
    createdAt: createdAt(),
    id: text("id").primaryKey(),
    orderItemId: text("order_item_id")
      .notNull()
      .unique()
      .references(() => orderItemsTable.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    status: reservationStatusEnum("status").default("HELD").notNull(),
    updatedAt: updatedAt(),
    variantId: text("variant_id")
      .notNull()
      .references(() => productVariantsTable.id, { onDelete: "restrict" }),
  },
  (table) => [
    index("inventory_reservations_variant_id_idx").on(table.variantId),
    check(
      "inventory_reservations_quantity_positive",
      sql`${table.quantity} > 0`,
    ),
  ],
);
