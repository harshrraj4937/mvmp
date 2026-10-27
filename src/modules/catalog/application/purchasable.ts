import { and, desc, eq, gt, isNull, type SQL, sql } from "drizzle-orm";

import type { Database } from "~/db";

import {
  categoriesTable,
  inventoryTable,
  merchantsTable,
  productImagesTable,
  productsTable,
  productVariantsTable,
} from "~/db/schema";

/** A product a customer can buy right now, as storefront lists show it. */
export interface PurchasableProduct {
  categorySlug: string;
  coverImageUrl: null | string;
  merchantSlug: string;
  name: string;
  /** Lowest price over the active variants that are in stock. */
  priceFromPaise: number;
  productId: string;
  slug: string;
  storeName: string;
}

/**
 * Products customers can buy: PUBLISHED, not on an admin hold, from an
 * APPROVED shop, in an active category, with at least one active variant
 * in stock. Newest publish first.
 */
export async function listPurchasableProducts(
  db: Database,
  filter: { categorySlug?: string; limit?: number; merchantId?: string } = {},
): Promise<PurchasableProduct[]> {
  const conditions: (SQL | undefined)[] = [
    eq(productsTable.status, "PUBLISHED"),
    isNull(productsTable.adminHoldReason),
    eq(merchantsTable.status, "APPROVED"),
    eq(categoriesTable.isActive, true),
    eq(productVariantsTable.isActive, true),
    gt(inventoryTable.available, 0),
    filter.categorySlug
      ? eq(categoriesTable.slug, filter.categorySlug)
      : undefined,
    filter.merchantId
      ? eq(productsTable.merchantId, filter.merchantId)
      : undefined,
  ];
  const rows = await db
    .select({
      categorySlug: categoriesTable.slug,
      coverImageUrl: sql<null | string>`(
        select ${productImagesTable.url} from ${productImagesTable}
        where ${productImagesTable.productId} = ${productsTable.id}
        order by ${productImagesTable.sortOrder}, ${productImagesTable.createdAt}
        limit 1
      )`,
      merchantSlug: merchantsTable.slug,
      name: productsTable.name,
      priceFrom: sql<string>`min(${productVariantsTable.pricePaise})`,
      productId: productsTable.id,
      slug: productsTable.slug,
      storeName: merchantsTable.storeName,
    })
    .from(productsTable)
    .innerJoin(merchantsTable, eq(merchantsTable.id, productsTable.merchantId))
    .innerJoin(
      categoriesTable,
      eq(categoriesTable.id, productsTable.categoryId),
    )
    .innerJoin(
      productVariantsTable,
      eq(productVariantsTable.productId, productsTable.id),
    )
    .innerJoin(
      inventoryTable,
      eq(inventoryTable.variantId, productVariantsTable.id),
    )
    .where(and(...conditions))
    .groupBy(productsTable.id, merchantsTable.id, categoriesTable.id)
    .orderBy(desc(productsTable.publishedAt), desc(productsTable.id))
    .limit(Math.min(Math.max(filter.limit ?? 24, 1), 100));
  return rows.map(({ priceFrom, ...row }) => ({
    ...row,
    priceFromPaise: Number(priceFrom),
  }));
}
