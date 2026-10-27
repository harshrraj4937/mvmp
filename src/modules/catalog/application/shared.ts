import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq } from "drizzle-orm";

import type { Database } from "~/db";
import type { MerchantContext } from "~/modules/merchants";

import {
  categoriesTable,
  inventoryMovementsTable,
  inventoryTable,
  productsTable,
  productVariantsTable,
} from "~/db/schema";
import { uniqueViolation } from "~/platform/db-errors";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "~/platform/errors";

import type { VariantFields } from "../presentation/schemas";

/** A database handle or an open transaction. */
export type Executor = Database | Transaction;

export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface VariantView {
  available: number;
  declaredMrpPaise: null | number;
  heightMm: number;
  id: string;
  isActive: boolean;
  label: null | string;
  lengthMm: number;
  pricePaise: number;
  reserved: number;
  sku: string;
  weightGrams: number;
  widthMm: number;
}

export const variantColumns = {
  available: inventoryTable.available,
  declaredMrpPaise: productVariantsTable.declaredMrpPaise,
  heightMm: productVariantsTable.heightMm,
  id: productVariantsTable.id,
  isActive: productVariantsTable.isActive,
  label: productVariantsTable.label,
  lengthMm: productVariantsTable.lengthMm,
  pricePaise: productVariantsTable.pricePaise,
  reserved: inventoryTable.reserved,
  sku: productVariantsTable.sku,
  weightGrams: productVariantsTable.weightGrams,
  widthMm: productVariantsTable.widthMm,
};

export const productNotFound = () => new NotFoundError("Product not found.");
export const variantNotFound = () => new NotFoundError("Variant not found.");

export const archivedProduct = () =>
  new ConflictError("archived", "Archived products cannot be changed.");

/** Refuses a category that does not exist or is hidden. */
export async function assertActiveCategory(
  db: Executor,
  categoryId: string,
): Promise<void> {
  const [category] = await db
    .select({ isActive: categoriesTable.isActive })
    .from(categoriesTable)
    .where(eq(categoriesTable.id, categoryId));
  if (!category?.isActive) {
    throw new ValidationError(undefined, {
      categoryId: ["Choose an active category."],
    });
  }
}

/**
 * Inserts a variant, its inventory row and, for opening stock, an INITIAL
 * movement. Runs inside the caller's transaction.
 */
export async function insertVariant(
  tx: Transaction,
  ctx: MerchantContext,
  productId: string,
  fields: VariantFields,
  options: { initialStock: number; label: null | string; sortOrder: number },
): Promise<string> {
  const id = createId();
  await tx.insert(productVariantsTable).values({
    declaredMrpPaise: fields.mrp ?? null,
    heightMm: fields.heightMm,
    id,
    label: options.label,
    lengthMm: fields.lengthMm,
    merchantId: ctx.merchantId,
    pricePaise: fields.price,
    productId,
    sku: fields.sku,
    sortOrder: options.sortOrder,
    weightGrams: fields.weightGrams,
    widthMm: fields.widthMm,
  });
  await tx
    .insert(inventoryTable)
    .values({ available: options.initialStock, variantId: id });
  if (options.initialStock > 0) {
    await tx.insert(inventoryMovementsTable).values({
      actorUserId: ctx.userId,
      availableAfter: options.initialStock,
      delta: options.initialStock,
      id: createId(),
      reason: "INITIAL",
      variantId: id,
    });
  }
  return id;
}

export async function listVariants(
  db: Executor,
  productId: string,
): Promise<VariantView[]> {
  return db
    .select(variantColumns)
    .from(productVariantsTable)
    .innerJoin(
      inventoryTable,
      eq(inventoryTable.variantId, productVariantsTable.id),
    )
    .where(eq(productVariantsTable.productId, productId))
    .orderBy(
      asc(productVariantsTable.sortOrder),
      asc(productVariantsTable.createdAt),
    );
}

/**
 * The caller's product; another shop's id is "not found". `lock` takes a row
 * lock so variant rules (labels, last active variant) are checked against a
 * stable set.
 */
export async function loadOwnedProduct(
  db: Executor,
  ctx: MerchantContext,
  productId: string,
  options: { lock?: boolean } = {},
) {
  const query = db
    .select()
    .from(productsTable)
    .where(
      and(
        eq(productsTable.id, productId),
        eq(productsTable.merchantId, ctx.merchantId),
      ),
    );
  const [product] = await (options.lock ? query.for("update") : query);
  if (!product) {
    throw productNotFound();
  }
  return product;
}

/** The caller's variant with its product's id and status. */
export async function loadOwnedVariant(
  db: Executor,
  ctx: MerchantContext,
  variantId: string,
) {
  const [variant] = await db
    .select({
      ...variantColumns,
      productId: productVariantsTable.productId,
      productStatus: productsTable.status,
    })
    .from(productVariantsTable)
    .innerJoin(
      productsTable,
      eq(productsTable.id, productVariantsTable.productId),
    )
    .innerJoin(
      inventoryTable,
      eq(inventoryTable.variantId, productVariantsTable.id),
    )
    .where(
      and(
        eq(productVariantsTable.id, variantId),
        eq(productVariantsTable.merchantId, ctx.merchantId),
      ),
    );
  if (!variant) {
    throw variantNotFound();
  }
  return variant;
}

/** One variant as the merchant sees it; ownership is checked by the caller. */
export async function loadVariantView(
  db: Executor,
  variantId: string,
): Promise<VariantView> {
  const [variant] = await db
    .select(variantColumns)
    .from(productVariantsTable)
    .innerJoin(
      inventoryTable,
      eq(inventoryTable.variantId, productVariantsTable.id),
    )
    .where(eq(productVariantsTable.id, variantId));
  if (!variant) {
    throw variantNotFound();
  }
  return variant;
}

/** Maps the per-merchant SKU unique violation; rethrows anything else. */
export function rethrowSkuTaken(error: unknown): never {
  if (uniqueViolation(error) === "product_variants_merchant_sku_unique") {
    throw skuTaken();
  }
  throw error;
}

export function skuTaken() {
  const message = "You already use this SKU.";
  return new ConflictError("sku_taken", message, { sku: [message] });
}
