import { relations } from "drizzle-orm";

import { merchantsTable } from "../merchants/tables";
import { userTable } from "../users/tables";
import {
  customerAddressesTable,
  merchantOrdersTable,
  orderAddressSnapshotsTable,
  orderItemsTable,
  ordersTable,
} from "./tables";

export const customerAddressesRelations = relations(
  customerAddressesTable,
  ({ one }) => ({
    user: one(userTable, {
      fields: [customerAddressesTable.userId],
      references: [userTable.id],
    }),
  }),
);

export const ordersRelations = relations(ordersTable, ({ many, one }) => ({
  address: one(orderAddressSnapshotsTable),
  parts: many(merchantOrdersTable),
  user: one(userTable, {
    fields: [ordersTable.userId],
    references: [userTable.id],
  }),
}));

export const merchantOrdersRelations = relations(
  merchantOrdersTable,
  ({ many, one }) => ({
    items: many(orderItemsTable),
    merchant: one(merchantsTable, {
      fields: [merchantOrdersTable.merchantId],
      references: [merchantsTable.id],
    }),
    order: one(ordersTable, {
      fields: [merchantOrdersTable.orderId],
      references: [ordersTable.id],
    }),
  }),
);

export const orderItemsRelations = relations(orderItemsTable, ({ one }) => ({
  part: one(merchantOrdersTable, {
    fields: [orderItemsTable.merchantOrderId],
    references: [merchantOrdersTable.id],
  }),
}));

export const orderAddressSnapshotsRelations = relations(
  orderAddressSnapshotsTable,
  ({ one }) => ({
    order: one(ordersTable, {
      fields: [orderAddressSnapshotsTable.orderId],
      references: [ordersTable.id],
    }),
  }),
);
