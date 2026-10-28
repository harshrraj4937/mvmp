import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import {
  COMPOSITION_LABELS,
  MADE_HOW,
  STOCK_REASONS,
} from "../../../modules/catalog/domain/constants";
import { PRODUCT_STATUSES } from "../../../modules/catalog/domain/product-status";
import { merchantsTable } from "../merchants/tables";
import { userTable } from "../users/tables";

export const productStatusEnum = pgEnum("product_status", PRODUCT_STATUSES);

export const inventoryMovementReasonEnum = pgEnum(
  "inventory_movement_reason",
  STOCK_REASONS,
);

export const madeHowEnum = pgEnum("made_how", MADE_HOW);

export const compositionLabelEnum = pgEnum(
  "composition_label",
  COMPOSITION_LABELS,
);

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull();

/** Admin-managed product categories; seeded by migration 0004. */
export const categoriesTable = pgTable(
  "categories",
  {
    // What product pages call the composition of products in this category.
    compositionLabel: compositionLabelEnum("composition_label")
      .default("INGREDIENTS")
      .notNull(),
    createdAt: createdAt(),
    id: text("id").primaryKey(),
    isActive: boolean("is_active").default(true).notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("categories_name_unique").on(table.name),
    unique("categories_slug_unique").on(table.slug),
  ],
);

export const productsTable = pgTable(
  "products",
  {
    adminHoldAt: timestamp("admin_hold_at", { withTimezone: true }),
    adminHoldBy: text("admin_hold_by").references(() => userTable.id, {
      onDelete: "set null",
    }),
    // Set when an admin unpublishes the product; blocks republishing.
    adminHoldReason: text("admin_hold_reason"),
    categoryId: text("category_id")
      .notNull()
      .references(() => categoriesTable.id, { onDelete: "restrict" }),
    // Ingredients or materials, labelled by the category.
    composition: text("composition"),
    createdAt: createdAt(),
    currency: text("currency").default("INR").notNull(),
    description: text("description"),
    id: text("id").primaryKey(),
    madeBy: text("made_by"),
    madeHow: madeHowEnum("made_how"),
    merchantId: text("merchant_id")
      .notNull()
      .references(() => merchantsTable.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    // Village, town or district the product comes from.
    originPlace: text("origin_place"),
    // A slug from INDIAN_STATES.
    originState: text("origin_state"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    slug: text("slug").notNull(),
    status: productStatusEnum("status").default("DRAFT").notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("products_merchant_slug_unique").on(table.merchantId, table.slug),
    index("products_merchant_status_idx").on(table.merchantId, table.status),
    index("products_origin_state_idx").on(table.originState),
    index("products_made_how_idx").on(table.madeHow),
    index("products_status_published_at_idx").on(
      table.status,
      table.publishedAt,
    ),
    check("products_currency_inr", sql`${table.currency} = 'INR'`),
  ],
);

export const productVariantsTable = pgTable(
  "product_variants",
  {
    createdAt: createdAt(),
    declaredMrpPaise: bigint("declared_mrp_paise", { mode: "number" }),
    heightMm: integer("height_mm").notNull(),
    id: text("id").primaryKey(),
    isActive: boolean("is_active").default(true).notNull(),
    // Null for a product's single default variant.
    label: text("label"),
    lengthMm: integer("length_mm").notNull(),
    // Denormalised from the product so SKUs can be unique per merchant.
    merchantId: text("merchant_id")
      .notNull()
      .references(() => merchantsTable.id, { onDelete: "restrict" }),
    pricePaise: bigint("price_paise", { mode: "number" }).notNull(),
    productId: text("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    // Reserved for seller-base pricing (ADR-018); unused in Phase 3.
    sellerBasePricePaise: bigint("seller_base_price_paise", { mode: "number" }),
    sku: text("sku").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    updatedAt: updatedAt(),
    weightGrams: integer("weight_grams").notNull(),
    widthMm: integer("width_mm").notNull(),
  },
  (table) => [
    unique("product_variants_merchant_sku_unique").on(
      table.merchantId,
      table.sku,
    ),
    index("product_variants_product_id_idx").on(table.productId),
    check("product_variants_price_positive", sql`${table.pricePaise} > 0`),
    check(
      "product_variants_mrp_gte_price",
      sql`${table.declaredMrpPaise} IS NULL OR ${table.declaredMrpPaise} >= ${table.pricePaise}`,
    ),
    check("product_variants_weight_positive", sql`${table.weightGrams} > 0`),
    check(
      "product_variants_dimensions_positive",
      sql`${table.lengthMm} > 0 AND ${table.widthMm} > 0 AND ${table.heightMm} > 0`,
    ),
  ],
);

export const productImagesTable = pgTable(
  "product_images",
  {
    alt: text("alt").notNull(),
    bytes: integer("bytes").notNull(),
    contentType: text("content_type").notNull(),
    createdAt: createdAt(),
    height: integer("height").notNull(),
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").default(0).notNull(),
    storageKey: text("storage_key").notNull(),
    updatedAt: updatedAt(),
    url: text("url").notNull(),
    width: integer("width").notNull(),
  },
  (table) => [index("product_images_product_id_idx").on(table.productId)],
);

export const inventoryTable = pgTable(
  "inventory",
  {
    available: integer("available").default(0).notNull(),
    // Held for unpaid orders from Phase 5; always 0 until then.
    reserved: integer("reserved").default(0).notNull(),
    updatedAt: updatedAt(),
    variantId: text("variant_id")
      .primaryKey()
      .references(() => productVariantsTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    check("inventory_available_nonnegative", sql`${table.available} >= 0`),
    check("inventory_reserved_nonnegative", sql`${table.reserved} >= 0`),
  ],
);

export const inventoryMovementsTable = pgTable(
  "inventory_movements",
  {
    actorUserId: text("actor_user_id").references(() => userTable.id, {
      onDelete: "set null",
    }),
    availableAfter: integer("available_after").notNull(),
    createdAt: createdAt(),
    delta: integer("delta").notNull(),
    id: text("id").primaryKey(),
    note: text("note"),
    reason: inventoryMovementReasonEnum("reason").notNull(),
    variantId: text("variant_id")
      .notNull()
      .references(() => productVariantsTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("inventory_movements_variant_id_idx").on(table.variantId),
    check("inventory_movements_delta_nonzero", sql`${table.delta} <> 0`),
  ],
);
