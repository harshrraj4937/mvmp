import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { productVariantsTable } from "../catalog/tables";
import { userTable } from "../users/tables";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull();

/** A shopper's cart: a signed-in user's, or a guest's behind a cookie. */
export const cartsTable = pgTable(
  "carts",
  {
    createdAt: createdAt(),
    // SHA-256 of the guest cookie token; the token itself is never stored.
    guestTokenHash: text("guest_token_hash").unique(),
    id: text("id").primaryKey(),
    updatedAt: updatedAt(),
    userId: text("user_id")
      .unique()
      .references(() => userTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    check(
      "carts_one_owner",
      sql`(${table.userId} IS NULL) <> (${table.guestTokenHash} IS NULL)`,
    ),
  ],
);

export const cartItemsTable = pgTable(
  "cart_items",
  {
    cartId: text("cart_id")
      .notNull()
      .references(() => cartsTable.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    id: text("id").primaryKey(),
    quantity: integer("quantity").notNull(),
    // The price the shopper last saw, to tell them when it changes.
    unitPricePaiseSeen: bigint("unit_price_paise_seen", {
      mode: "number",
    }).notNull(),
    updatedAt: updatedAt(),
    variantId: text("variant_id")
      .notNull()
      .references(() => productVariantsTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    unique("cart_items_cart_variant_unique").on(table.cartId, table.variantId),
    index("cart_items_variant_id_idx").on(table.variantId),
    check("cart_items_quantity_range", sql`${table.quantity} BETWEEN 1 AND 10`),
  ],
);
