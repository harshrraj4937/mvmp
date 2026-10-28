import {
  and,
  asc,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  type SQL,
  sql,
} from "drizzle-orm";

import {
  categoriesTable,
  inventoryTable,
  merchantsTable,
  merchantStoryImagesTable,
  productImagesTable,
  productsTable,
  productVariantsTable,
} from "~/db/schema";
import { isShopStoryComplete } from "~/modules/merchants/domain/story";

import type { CompositionLabel, MadeHow } from "../domain/constants";
import type { StateSlug } from "../domain/indian-states";
import type { StorefrontQuery } from "../presentation/storefront-query";
import type { ProductImageView } from "./products";
import type { Executor } from "./shared";

import { isStateSlug, stateName } from "../domain/indian-states";

export const STOREFRONT_PAGE_SIZE = 24;

/** Upper bound on products listed on one shop page. */
const SHOP_PRODUCT_LIMIT = 1000;

export interface CartVariantInfo {
  available: number;
  coverImageUrl: null | string;
  merchantId: string;
  pricePaise: number;
  productName: string;
  productSlug: string;
  /** The product is on sale and this variant is active (stock is `available`). */
  purchasable: boolean;
  shopLinkable: boolean;
  shopSlug: string;
  storeName: string;
  variantId: string;
  variantLabel: null | string;
}

export interface StorefrontCard {
  coverImageUrl: null | string;
  madeBy: null | string;
  madeHow: MadeHow | null;
  name: string;
  originPlace: null | string;
  originState: null | StateSlug;
  priceFromPaise: number;
  productId: string;
  /** False until the shop's story is complete: no link to its page. */
  shopLinkable: boolean;
  shopSlug: string;
  slug: string;
  storeName: string;
}

export interface StorefrontProduct extends StorefrontCard {
  categoryName: string;
  categorySlug: string;
  composition: null | string;
  compositionLabel: CompositionLabel;
  description: null | string;
  images: ProductImageView[];
  shop: {
    coverUrl: null | string;
    homePlace: null | string;
    homeState: null | StateSlug;
    storeName: string;
    storyExcerpt: null | string;
  };
  /** Active variants in display order; sold-out ones are included with `available: 0`. */
  variants: {
    available: number;
    declaredMrpPaise: null | number;
    id: string;
    label: null | string;
    pricePaise: number;
  }[];
}

export interface StorefrontShop {
  homePlace: string;
  homeState: StateSlug;
  images: {
    alt: string;
    height: number;
    id: string;
    sortOrder: number;
    url: string;
    width: number;
  }[];
  products: StorefrontCard[];
  slug: string;
  storeName: string;
  story: string;
}

/** The subset of `merchantIds` whose shop story is complete. */
async function completeShopIds(
  db: Executor,
  merchantIds: string[],
): Promise<Set<string>> {
  if (merchantIds.length === 0) {
    return new Set();
  }
  const [shops, photos] = await Promise.all([
    db
      .select({
        homePlace: merchantsTable.homePlace,
        homeState: merchantsTable.homeState,
        id: merchantsTable.id,
        story: merchantsTable.story,
      })
      .from(merchantsTable)
      .where(inArray(merchantsTable.id, merchantIds)),
    db
      .select({
        count: sql<number>`count(*)::int`,
        merchantId: merchantStoryImagesTable.merchantId,
      })
      .from(merchantStoryImagesTable)
      .where(inArray(merchantStoryImagesTable.merchantId, merchantIds))
      .groupBy(merchantStoryImagesTable.merchantId),
  ]);
  const photoCounts = new Map(photos.map((row) => [row.merchantId, row.count]));
  return new Set(
    shops
      .filter((shop) =>
        isShopStoryComplete({
          ...shop,
          images: photoCounts.get(shop.id) ?? 0,
        }),
      )
      .map((shop) => shop.id),
  );
}

/**
 * Product-level rules for a purchasable product (spec §6.1): published, not
 * on an admin hold, from an approved shop, in an active category. Every
 * storefront query uses this builder; the product, merchant and category
 * tables must be joined.
 */
function productOnSale(): SQL[] {
  return [
    eq(productsTable.status, "PUBLISHED"),
    isNull(productsTable.adminHoldReason),
    eq(merchantsTable.status, "APPROVED"),
    eq(categoriesTable.isActive, true),
  ];
}

/** A variant a customer can buy now: active and in stock. Variant and inventory joined. */
function sellableVariant(): SQL[] {
  return [
    eq(productVariantsTable.isActive, true),
    gt(inventoryTable.available, 0),
  ];
}

const coverSql = sql<null | string>`(
  select ${productImagesTable.url} from ${productImagesTable}
  where ${productImagesTable.productId} = ${productsTable.id}
  order by ${productImagesTable.sortOrder}, ${productImagesTable.createdAt}
  limit 1
)`;

const priceFromSql = sql<string>`min(${productVariantsTable.pricePaise})`;

interface CardRow {
  coverImageUrl: null | string;
  madeBy: null | string;
  madeHow: MadeHow | null;
  merchantId: string;
  merchantSlug: string;
  name: string;
  originPlace: null | string;
  originState: null | string;
  priceFrom: string;
  productId: string;
  slug: string;
  storeName: string;
}

/** One purchasable product by its shop and product slugs, or null. */
export async function getStorefrontProduct(
  db: Executor,
  shopSlug: string,
  productSlug: string,
): Promise<null | StorefrontProduct> {
  const [row] = await cardRows(
    db,
    [eq(merchantsTable.slug, shopSlug), eq(productsTable.slug, productSlug)],
    [],
    1,
    0,
  );
  if (!row) {
    return null;
  }
  const [[card], images, variants, [detail], [shop], coverUrl] =
    await Promise.all([
      toCards(db, [row]),
      db
        .select({
          alt: productImagesTable.alt,
          height: productImagesTable.height,
          id: productImagesTable.id,
          sortOrder: productImagesTable.sortOrder,
          url: productImagesTable.url,
          width: productImagesTable.width,
        })
        .from(productImagesTable)
        .where(eq(productImagesTable.productId, row.productId))
        .orderBy(
          asc(productImagesTable.sortOrder),
          asc(productImagesTable.createdAt),
        ),
      db
        .select({
          available: inventoryTable.available,
          declaredMrpPaise: productVariantsTable.declaredMrpPaise,
          id: productVariantsTable.id,
          label: productVariantsTable.label,
          pricePaise: productVariantsTable.pricePaise,
        })
        .from(productVariantsTable)
        .innerJoin(
          inventoryTable,
          eq(inventoryTable.variantId, productVariantsTable.id),
        )
        .where(
          and(
            eq(productVariantsTable.productId, row.productId),
            eq(productVariantsTable.isActive, true),
          ),
        )
        .orderBy(
          asc(productVariantsTable.sortOrder),
          asc(productVariantsTable.createdAt),
        ),
      db
        .select({
          categoryName: categoriesTable.name,
          categorySlug: categoriesTable.slug,
          composition: productsTable.composition,
          compositionLabel: categoriesTable.compositionLabel,
          description: productsTable.description,
        })
        .from(productsTable)
        .innerJoin(
          categoriesTable,
          eq(categoriesTable.id, productsTable.categoryId),
        )
        .where(eq(productsTable.id, row.productId)),
      db
        .select({
          homePlace: merchantsTable.homePlace,
          homeState: merchantsTable.homeState,
          storeName: merchantsTable.storeName,
          story: merchantsTable.story,
        })
        .from(merchantsTable)
        .where(eq(merchantsTable.id, row.merchantId)),
      shopCoverUrl(db, row.merchantId),
    ]);
  if (!card || !detail || !shop) {
    return null;
  }
  return {
    ...card,
    categoryName: detail.categoryName,
    categorySlug: detail.categorySlug,
    composition: detail.composition,
    compositionLabel: detail.compositionLabel,
    description: detail.description,
    images,
    shop: {
      coverUrl,
      homePlace: shop.homePlace,
      homeState: asStateSlug(shop.homeState),
      storeName: shop.storeName,
      storyExcerpt: shop.story === null ? null : storyExcerpt(shop.story),
    },
    variants,
  };
}

/**
 * An APPROVED shop whose story is complete, with its photos and every
 * purchasable product, newest first. Null otherwise.
 */
export async function getStorefrontShop(
  db: Executor,
  shopSlug: string,
): Promise<null | StorefrontShop> {
  const [shop] = await db
    .select({
      homePlace: merchantsTable.homePlace,
      homeState: merchantsTable.homeState,
      id: merchantsTable.id,
      storeName: merchantsTable.storeName,
      story: merchantsTable.story,
    })
    .from(merchantsTable)
    .where(
      and(
        eq(merchantsTable.slug, shopSlug),
        eq(merchantsTable.status, "APPROVED"),
      ),
    );
  if (!shop) {
    return null;
  }
  const complete = await completeShopIds(db, [shop.id]);
  const homeState = asStateSlug(shop.homeState);
  if (!complete.has(shop.id) || !shop.story || !shop.homePlace || !homeState) {
    return null;
  }
  const [images, rows] = await Promise.all([
    db
      .select({
        alt: merchantStoryImagesTable.alt,
        height: merchantStoryImagesTable.height,
        id: merchantStoryImagesTable.id,
        sortOrder: merchantStoryImagesTable.sortOrder,
        url: merchantStoryImagesTable.url,
        width: merchantStoryImagesTable.width,
      })
      .from(merchantStoryImagesTable)
      .where(eq(merchantStoryImagesTable.merchantId, shop.id))
      .orderBy(
        asc(merchantStoryImagesTable.sortOrder),
        asc(merchantStoryImagesTable.createdAt),
      ),
    cardRows(
      db,
      [eq(merchantsTable.id, shop.id)],
      [desc(productsTable.publishedAt)],
      SHOP_PRODUCT_LIMIT,
      0,
    ),
  ]);
  return {
    homePlace: shop.homePlace,
    homeState,
    images,
    products: await toCards(db, rows),
    slug: shopSlug,
    storeName: shop.storeName,
    story: shop.story,
  };
}

/**
 * Variant details for cart lines. Unknown variant ids are left out of the
 * result; the cart service decides what that means.
 */
export async function getVariantsForCart(
  db: Executor,
  variantIds: string[],
): Promise<CartVariantInfo[]> {
  if (variantIds.length === 0) {
    return [];
  }
  const [rows, saleable] = await Promise.all([
    db
      .select({
        available: inventoryTable.available,
        coverImageUrl: coverSql,
        merchantId: merchantsTable.id,
        pricePaise: productVariantsTable.pricePaise,
        productName: productsTable.name,
        productSlug: productsTable.slug,
        shopSlug: merchantsTable.slug,
        storeName: merchantsTable.storeName,
        variantId: productVariantsTable.id,
        variantLabel: productVariantsTable.label,
      })
      .from(productVariantsTable)
      .innerJoin(
        productsTable,
        eq(productsTable.id, productVariantsTable.productId),
      )
      .innerJoin(
        merchantsTable,
        eq(merchantsTable.id, productsTable.merchantId),
      )
      .innerJoin(
        categoriesTable,
        eq(categoriesTable.id, productsTable.categoryId),
      )
      .innerJoin(
        inventoryTable,
        eq(inventoryTable.variantId, productVariantsTable.id),
      )
      .where(inArray(productVariantsTable.id, variantIds)),
    db
      .select({ id: productVariantsTable.id })
      .from(productVariantsTable)
      .innerJoin(
        productsTable,
        eq(productsTable.id, productVariantsTable.productId),
      )
      .innerJoin(
        merchantsTable,
        eq(merchantsTable.id, productsTable.merchantId),
      )
      .innerJoin(
        categoriesTable,
        eq(categoriesTable.id, productsTable.categoryId),
      )
      .where(
        and(
          ...productOnSale(),
          eq(productVariantsTable.isActive, true),
          inArray(productVariantsTable.id, variantIds),
        ),
      ),
  ]);
  const onSale = new Set(saleable.map((row) => row.id));
  const complete = await completeShopIds(db, [
    ...new Set(rows.map((row) => row.merchantId)),
  ]);
  return rows.map((row) => ({
    available: row.available,
    coverImageUrl: row.coverImageUrl,
    merchantId: row.merchantId,
    pricePaise: row.pricePaise,
    productName: row.productName,
    productSlug: row.productSlug,
    purchasable: onSale.has(row.variantId),
    shopLinkable: complete.has(row.merchantId),
    shopSlug: row.shopSlug,
    storeName: row.storeName,
    variantId: row.variantId,
    variantLabel: row.variantLabel,
  }));
}

/**
 * Searches purchasable products. `regionCounts` covers every purchasable
 * product and ignores the filters, so the region menu always shows what
 * exists.
 */
export async function searchStorefront(
  db: Executor,
  query: StorefrontQuery,
): Promise<{
  items: StorefrontCard[];
  page: number;
  pageSize: typeof STOREFRONT_PAGE_SIZE;
  regionCounts: { count: number; name: string; slug: StateSlug }[];
  total: number;
}> {
  const filters: (SQL | undefined)[] = [];
  if (query.category) {
    filters.push(eq(categoriesTable.slug, query.category));
  }
  if (query.made) {
    filters.push(
      eq(
        productsTable.madeHow,
        query.made === "handmade" ? "HANDMADE" : "HOMEMADE",
      ),
    );
  }
  if (query.region) {
    filters.push(eq(productsTable.originState, query.region));
  }
  if (query.q) {
    const pattern = likePattern(query.q);
    filters.push(
      or(
        ilike(productsTable.name, pattern),
        ilike(productsTable.madeBy, pattern),
        ilike(productsTable.originPlace, pattern),
        ilike(productsTable.composition, pattern),
        ilike(merchantsTable.storeName, pattern),
      ),
    );
  }

  const order =
    query.sort === "price_asc"
      ? [asc(priceFromSql)]
      : query.sort === "price_desc"
        ? [desc(priceFromSql)]
        : [desc(productsTable.publishedAt)];

  const page = Math.max(1, query.page);
  const [rows, [totals], regionRows] = await Promise.all([
    cardRows(
      db,
      filters,
      order,
      STOREFRONT_PAGE_SIZE,
      (page - 1) * STOREFRONT_PAGE_SIZE,
    ),
    db
      .select({ total: sql<number>`count(distinct ${productsTable.id})::int` })
      .from(productsTable)
      .innerJoin(
        merchantsTable,
        eq(merchantsTable.id, productsTable.merchantId),
      )
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
      .where(and(...productOnSale(), ...sellableVariant(), ...filters)),
    regionCounts(db),
  ]);

  return {
    items: await toCards(db, rows),
    page,
    pageSize: STOREFRONT_PAGE_SIZE,
    regionCounts: regionRows,
    total: totals?.total ?? 0,
  };
}

/** The newest purchasable products, categories and regions, for the landing page. */
export async function storefrontHighlights(db: Executor): Promise<{
  categories: { name: string; slug: string }[];
  newest: StorefrontCard[];
  regions: StateSlug[];
}> {
  const [newestRows, categoryRows, regionRows] = await Promise.all([
    cardRows(db, [], [desc(productsTable.publishedAt)], 3, 0),
    db
      .selectDistinct({
        name: categoriesTable.name,
        slug: categoriesTable.slug,
        sortOrder: categoriesTable.sortOrder,
      })
      .from(productsTable)
      .innerJoin(
        merchantsTable,
        eq(merchantsTable.id, productsTable.merchantId),
      )
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
      .where(and(...productOnSale(), ...sellableVariant()))
      .orderBy(asc(categoriesTable.sortOrder), asc(categoriesTable.name)),
    db
      .selectDistinct({ slug: productsTable.originState })
      .from(productsTable)
      .innerJoin(
        merchantsTable,
        eq(merchantsTable.id, productsTable.merchantId),
      )
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
      .where(
        and(
          ...productOnSale(),
          ...sellableVariant(),
          isNotNull(productsTable.originState),
        ),
      ),
  ]);
  const regions: StateSlug[] = [];
  for (const row of regionRows) {
    const slug = asStateSlug(row.slug);
    if (slug !== null) {
      regions.push(slug);
    }
  }
  return {
    categories: categoryRows.map(({ name, slug }) => ({ name, slug })),
    newest: await toCards(db, newestRows),
    regions,
  };
}

/** The first 240 characters of the story, cut back to a word boundary. */
export function storyExcerpt(story: string, max = 240): string {
  if (story.length <= max) {
    return story;
  }
  const cut = story.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > 0 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function asStateSlug(value: null | string): null | StateSlug {
  return value !== null && isStateSlug(value) ? value : null;
}

/**
 * Purchasable product cards, the one query behind every list. Products with
 * no sellable variant drop out at the inner join.
 */
async function cardRows(
  db: Executor,
  conditions: (SQL | undefined)[],
  order: SQL[],
  limit: number,
  offset: number,
): Promise<CardRow[]> {
  return db
    .select({
      coverImageUrl: coverSql,
      madeBy: productsTable.madeBy,
      madeHow: productsTable.madeHow,
      merchantId: merchantsTable.id,
      merchantSlug: merchantsTable.slug,
      name: productsTable.name,
      originPlace: productsTable.originPlace,
      originState: productsTable.originState,
      priceFrom: priceFromSql,
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
    .where(and(...productOnSale(), ...sellableVariant(), ...conditions))
    .groupBy(productsTable.id, merchantsTable.id)
    .orderBy(...order, asc(productsTable.id))
    .limit(limit)
    .offset(offset);
}

/** Escapes LIKE wildcards so a search for "%" or "_" matches literally. */
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

async function regionCounts(
  db: Executor,
): Promise<{ count: number; name: string; slug: StateSlug }[]> {
  const rows = await db
    .select({
      count: sql<number>`count(distinct ${productsTable.id})::int`,
      slug: productsTable.originState,
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
    .where(
      and(
        ...productOnSale(),
        ...sellableVariant(),
        isNotNull(productsTable.originState),
      ),
    )
    .groupBy(productsTable.originState);
  const counts: { count: number; name: string; slug: StateSlug }[] = [];
  for (const row of rows) {
    const slug = asStateSlug(row.slug);
    if (slug !== null) {
      counts.push({ count: row.count, name: stateName(slug), slug });
    }
  }
  return counts.sort((a, b) => a.name.localeCompare(b.name));
}

/** Stored paths of a shop's story photos, cover first. */
async function shopCoverUrl(
  db: Executor,
  merchantId: string,
): Promise<null | string> {
  const [first] = await db
    .select({ url: merchantStoryImagesTable.url })
    .from(merchantStoryImagesTable)
    .where(eq(merchantStoryImagesTable.merchantId, merchantId))
    .orderBy(
      asc(merchantStoryImagesTable.sortOrder),
      asc(merchantStoryImagesTable.createdAt),
    )
    .limit(1);
  return first?.url ?? null;
}

async function toCards(
  db: Executor,
  rows: CardRow[],
): Promise<StorefrontCard[]> {
  const complete = await completeShopIds(db, [
    ...new Set(rows.map((row) => row.merchantId)),
  ]);
  return rows.map((row) => ({
    coverImageUrl: row.coverImageUrl,
    madeBy: row.madeBy,
    madeHow: row.madeHow,
    name: row.name,
    originPlace: row.originPlace,
    originState: asStateSlug(row.originState),
    priceFromPaise: Number(row.priceFrom),
    productId: row.productId,
    shopLinkable: complete.has(row.merchantId),
    shopSlug: row.merchantSlug,
    slug: row.slug,
    storeName: row.storeName,
  }));
}
