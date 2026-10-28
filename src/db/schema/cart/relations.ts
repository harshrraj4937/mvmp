import { relations } from "drizzle-orm";

import { productVariantsTable } from "../catalog/tables";
import { userTable } from "../users/tables";
import { cartItemsTable, cartsTable } from "./tables";

export const cartsRelations = relations(cartsTable, ({ many, one }) => ({
  items: many(cartItemsTable),
  user: one(userTable, {
    fields: [cartsTable.userId],
    references: [userTable.id],
  }),
}));

export const cartItemsRelations = relations(cartItemsTable, ({ one }) => ({
  cart: one(cartsTable, {
    fields: [cartItemsTable.cartId],
    references: [cartsTable.id],
  }),
  variant: one(productVariantsTable, {
    fields: [cartItemsTable.variantId],
    references: [productVariantsTable.id],
  }),
}));
