import { relations } from "drizzle-orm";

import { userTable } from "../users/tables";
import {
  merchantMembersTable,
  merchantPickupLocationsTable,
  merchantsTable,
  merchantStoryImagesTable,
} from "./tables";

export const merchantsRelations = relations(merchantsTable, ({ many }) => ({
  members: many(merchantMembersTable),
  pickupLocations: many(merchantPickupLocationsTable),
  storyImages: many(merchantStoryImagesTable),
}));

export const merchantStoryImagesRelations = relations(
  merchantStoryImagesTable,
  ({ one }) => ({
    merchant: one(merchantsTable, {
      fields: [merchantStoryImagesTable.merchantId],
      references: [merchantsTable.id],
    }),
  }),
);

export const merchantMembersRelations = relations(
  merchantMembersTable,
  ({ one }) => ({
    merchant: one(merchantsTable, {
      fields: [merchantMembersTable.merchantId],
      references: [merchantsTable.id],
    }),
    user: one(userTable, {
      fields: [merchantMembersTable.userId],
      references: [userTable.id],
    }),
  }),
);

export const merchantPickupLocationsRelations = relations(
  merchantPickupLocationsTable,
  ({ one }) => ({
    merchant: one(merchantsTable, {
      fields: [merchantPickupLocationsTable.merchantId],
      references: [merchantsTable.id],
    }),
  }),
);
