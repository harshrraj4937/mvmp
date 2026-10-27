import { createId } from "@paralleldrive/cuid2";
import {
  and,
  asc,
  desc,
  eq,
  exists,
  ilike,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm";

import type { Database } from "~/db";
import type { MerchantContext } from "~/modules/merchants";

import {
  categoriesTable,
  inventoryTable,
  productImagesTable,
  productsTable,
  productVariantsTable,
} from "~/db/schema";
import { suggestSlug } from "~/lib/slug";
import { uniqueViolation } from "~/platform/db-errors";
import { ConflictError } from "~/platform/errors";

import type { ProductCreate, ProductPatch } from "../presentation/schemas";

import { LOW_STOCK_THRESHOLD } from "../domain/constants";
import { PRODUCT_STATUSES, type ProductStatus } from "../domain/product-status";
import { type PublishBlocker, publishBlockers } from "../domain/publishability";
import {
  archivedProduct,
  assertActiveCategory,
  type Executor,
  insertVariant,
  listVariants,
  loadOwnedProduct,
  productNotFound,
  rethrowSkuTaken,
  type VariantView,
} from "./shared";

export interface ProductDetail extends ProductSummary {
  categoryId: string;
  description: null | string;
  images: ProductImageView[];
  publishBlockers: PublishBlocker[];
  variants: VariantView[];
}

export interface ProductImageView {
  alt: string;
  height: number;
  id: string;
  sortOrder: number;
  url: string;
  width: number;
}

export interface ProductSummary {
  adminHoldReason: null | string;
  categoryName: string;
  coverImageUrl: null | string;
  id: string;
  lowStock: boolean;
  name: string;
  priceFromPaise: null | number;
  slug: string;
  status: ProductStatus;
  totalAvailable: number;
}

/** Product counts for the merchant overview (archived products excluded from stock counts). */
export async function catalogCounts(
  db: Database,
  ctx: MerchantContext,
): Promise<{
  byStatus: Record<ProductStatus, number>;
  lowStock: number;
  outOfStock: number;
}> {
  const products = await summaries(db, ctx, []);
  const byStatus = Object.fromEntries(
    PRODUCT_STATUSES.map((status) => [status, 0]),
  ) as Record<ProductStatus, number>;
  let lowStock = 0;
  let outOfStock = 0;
  for (const product of products) {
    byStatus[product.status] += 1;
    if (product.status === "ARCHIVED") {
      continue;
    }
    if (product.totalAvailable === 0) {
      outOfStock += 1;
    } else if (product.lowStock) {
      lowStock += 1;
    }
  }
  return { byStatus, lowStock, outOfStock };
}

/**
 * Creates a DRAFT product with its default (unlabelled) variant, inventory
 * and opening-stock movement in one transaction.
 */
export async function createProduct(
  db: Database,
  ctx: MerchantContext,
  input: ProductCreate,
): Promise<ProductDetail> {
  await assertActiveCategory(db, input.categoryId);
  const productId = createId();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(productsTable).values({
        categoryId: input.categoryId,
        description: input.description ?? null,
        id: productId,
        merchantId: ctx.merchantId,
        name: input.name,
        slug: await freeSlug(tx, ctx, input.name),
      });
      await insertVariant(tx, ctx, productId, input.variant, {
        initialStock: input.initialStock,
        label: null,
        sortOrder: 0,
      });
    });
  } catch (error) {
    rethrowSkuTaken(error);
  }
  return getProduct(db, ctx, productId);
}

export async function getProduct(
  db: Executor,
  ctx: MerchantContext,
  productId: string,
): Promise<ProductDetail> {
  const [summary] = await summaries(db, ctx, [eq(productsTable.id, productId)]);
  if (!summary) {
    throw productNotFound();
  }
  const [[extra], variants, images] = await Promise.all([
    db
      .select({
        categoryActive: categoriesTable.isActive,
        categoryId: productsTable.categoryId,
        description: productsTable.description,
      })
      .from(productsTable)
      .innerJoin(
        categoriesTable,
        eq(categoriesTable.id, productsTable.categoryId),
      )
      .where(eq(productsTable.id, productId)),
    listVariants(db, productId),
    listImages(db, productId),
  ]);
  if (!extra) {
    throw productNotFound();
  }
  const active = variants.filter((variant) => variant.isActive);
  return {
    ...summary,
    categoryId: extra.categoryId,
    description: extra.description,
    images,
    publishBlockers: publishBlockers({
      activePricedVariants: active.filter((variant) => variant.pricePaise > 0)
        .length,
      categoryActive: extra.categoryActive,
      images: images.length,
    }),
    variants,
  };
}

/** The shop's products, newest change first; archived ones only on request. */
export async function listProducts(
  db: Database,
  ctx: MerchantContext,
  filter: { q?: string; status?: ProductStatus },
): Promise<ProductSummary[]> {
  const conditions: SQL[] = [
    filter.status
      ? eq(productsTable.status, filter.status)
      : ne(productsTable.status, "ARCHIVED"),
  ];
  const q = filter.q?.trim();
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const searched = or(
      ilike(productsTable.name, pattern),
      exists(
        db
          .select({ one: sql`1` })
          .from(productVariantsTable)
          .where(
            and(
              eq(productVariantsTable.productId, productsTable.id),
              ilike(productVariantsTable.sku, pattern),
            ),
          ),
      ),
    );
    if (searched) {
      conditions.push(searched);
    }
  }
  return summaries(db, ctx, conditions);
}

/**
 * Edits name, category, description or (while DRAFT) the URL slug.
 * Archived products are read-only.
 */
export async function updateProduct(
  db: Database,
  ctx: MerchantContext,
  productId: string,
  patch: ProductPatch,
): Promise<ProductDetail> {
  const product = await loadOwnedProduct(db, ctx, productId);
  if (product.status === "ARCHIVED") {
    throw archivedProduct();
  }
  if (
    patch.slug !== undefined &&
    patch.slug !== product.slug &&
    product.status !== "DRAFT"
  ) {
    throw new ConflictError(
      "slug_locked",
      "The product URL cannot change after the product has been published.",
    );
  }
  if (
    patch.categoryId !== undefined &&
    patch.categoryId !== product.categoryId
  ) {
    await assertActiveCategory(db, patch.categoryId);
  }
  try {
    const updated = await db
      .update(productsTable)
      .set(patch)
      .where(
        and(
          eq(productsTable.id, productId),
          ne(productsTable.status, "ARCHIVED"),
          // The slug check above read the status; keep it true at write time.
          patch.slug === undefined || patch.slug === product.slug
            ? undefined
            : eq(productsTable.status, "DRAFT"),
        ),
      )
      .returning({ id: productsTable.id });
    if (updated.length === 0) {
      throw archivedProduct();
    }
  } catch (error) {
    if (uniqueViolation(error) === "products_merchant_slug_unique") {
      const message = "Another of your products uses this URL.";
      throw new ConflictError("slug_taken", message, { slug: [message] });
    }
    throw error;
  }
  return getProduct(db, ctx, productId);
}

/** A slug from the name, suffixed when the shop already uses it. */
async function freeSlug(
  db: Executor,
  ctx: MerchantContext,
  name: string,
): Promise<string> {
  const base = suggestSlug(name).slice(0, 70) || "product";
  const [taken] = await db
    .select({ id: productsTable.id })
    .from(productsTable)
    .where(
      and(
        eq(productsTable.merchantId, ctx.merchantId),
        eq(productsTable.slug, base),
      ),
    );
  return taken ? `${base}-${createId().slice(0, 6)}` : base;
}

async function listImages(
  db: Executor,
  productId: string,
): Promise<ProductImageView[]> {
  return db
    .select({
      alt: productImagesTable.alt,
      height: productImagesTable.height,
      id: productImagesTable.id,
      sortOrder: productImagesTable.sortOrder,
      url: productImagesTable.url,
      width: productImagesTable.width,
    })
    .from(productImagesTable)
    .where(eq(productImagesTable.productId, productId))
    .orderBy(
      asc(productImagesTable.sortOrder),
      asc(productImagesTable.createdAt),
    );
}

async function summaries(
  db: Executor,
  ctx: MerchantContext,
  conditions: (SQL | undefined)[],
): Promise<ProductSummary[]> {
  const activeVariant = sql`${productVariantsTable.isActive}`;
  const rows = await db
    .select({
      adminHoldReason: productsTable.adminHoldReason,
      anyLow: sql<
        boolean | null
      >`bool_or(${activeVariant} and ${inventoryTable.available} <= ${LOW_STOCK_THRESHOLD})`,
      categoryName: categoriesTable.name,
      coverImageUrl: sql<null | string>`(
        select ${productImagesTable.url} from ${productImagesTable}
        where ${productImagesTable.productId} = ${productsTable.id}
        order by ${productImagesTable.sortOrder}, ${productImagesTable.createdAt}
        limit 1
      )`,
      id: productsTable.id,
      name: productsTable.name,
      priceFrom: sql<
        null | string
      >`min(${productVariantsTable.pricePaise}) filter (where ${activeVariant})`,
      slug: productsTable.slug,
      status: productsTable.status,
      totalAvailable: sql<string>`coalesce(sum(${inventoryTable.available}) filter (where ${activeVariant}), 0)`,
    })
    .from(productsTable)
    .innerJoin(
      categoriesTable,
      eq(categoriesTable.id, productsTable.categoryId),
    )
    .leftJoin(
      productVariantsTable,
      eq(productVariantsTable.productId, productsTable.id),
    )
    .leftJoin(
      inventoryTable,
      eq(inventoryTable.variantId, productVariantsTable.id),
    )
    .where(and(eq(productsTable.merchantId, ctx.merchantId), ...conditions))
    .groupBy(productsTable.id, categoriesTable.name)
    .orderBy(desc(productsTable.updatedAt), desc(productsTable.createdAt));
  return rows.map(({ anyLow, priceFrom, totalAvailable, ...row }) => {
    const total = Number(totalAvailable);
    return {
      ...row,
      lowStock: total > 0 && anyLow === true,
      priceFromPaise: priceFrom === null ? null : Number(priceFrom),
      totalAvailable: total,
    };
  });
}
