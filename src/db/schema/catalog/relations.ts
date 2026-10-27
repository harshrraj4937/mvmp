import { relations } from "drizzle-orm";

import { merchantsTable } from "../merchants/tables";
import {
  categoriesTable,
  inventoryMovementsTable,
  inventoryTable,
  productImagesTable,
  productsTable,
  productVariantsTable,
} from "./tables";

export const categoriesRelations = relations(categoriesTable, ({ many }) => ({
  products: many(productsTable),
}));

export const productsRelations = relations(productsTable, ({ many, one }) => ({
  category: one(categoriesTable, {
    fields: [productsTable.categoryId],
    references: [categoriesTable.id],
  }),
  images: many(productImagesTable),
  merchant: one(merchantsTable, {
    fields: [productsTable.merchantId],
    references: [merchantsTable.id],
  }),
  variants: many(productVariantsTable),
}));

export const productVariantsRelations = relations(
  productVariantsTable,
  ({ many, one }) => ({
    inventory: one(inventoryTable, {
      fields: [productVariantsTable.id],
      references: [inventoryTable.variantId],
    }),
    movements: many(inventoryMovementsTable),
    product: one(productsTable, {
      fields: [productVariantsTable.productId],
      references: [productsTable.id],
    }),
  }),
);

export const productImagesRelations = relations(
  productImagesTable,
  ({ one }) => ({
    product: one(productsTable, {
      fields: [productImagesTable.productId],
      references: [productsTable.id],
    }),
  }),
);

export const inventoryRelations = relations(inventoryTable, ({ one }) => ({
  variant: one(productVariantsTable, {
    fields: [inventoryTable.variantId],
    references: [productVariantsTable.id],
  }),
}));

export const inventoryMovementsRelations = relations(
  inventoryMovementsTable,
  ({ one }) => ({
    variant: one(productVariantsTable, {
      fields: [inventoryMovementsTable.variantId],
      references: [productVariantsTable.id],
    }),
  }),
);
