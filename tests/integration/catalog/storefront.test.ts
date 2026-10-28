import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import { productsTable } from "~/db/schema";
import { holdProduct } from "~/modules/catalog/application/admin";
import { updateCategory } from "~/modules/catalog/application/categories";
import { adjustStock } from "~/modules/catalog/application/inventory";
import { createProduct } from "~/modules/catalog/application/products";
import {
  archiveProduct,
  publishProduct,
  unpublishProduct,
} from "~/modules/catalog/application/status";
import {
  getStorefrontProduct,
  getStorefrontShop,
  getVariantsForCart,
  searchStorefront,
  storefrontHighlights,
} from "~/modules/catalog/application/storefront";
import {
  addVariant,
  updateVariant,
} from "~/modules/catalog/application/variants";
import { variantCreateSchema } from "~/modules/catalog/presentation/schemas";
import { suspendMerchant } from "~/modules/merchants/application/review";

import { testAdmin } from "../../support/merchant-fixtures";
import {
  addImageRow,
  productInput,
  seedApprovedMerchant,
  seedCategory,
} from "../support/catalog";
import { connectTestDb } from "../support/db";
import { seedUser } from "../support/merchants";

const { close, db } = connectTestDb();
afterAll(close);

const admin = async () => testAdmin(await seedUser(db, "admin"));

type Shop = Awaited<ReturnType<typeof seedApprovedMerchant>>;

async function product(
  shop: Shop,
  overrides: Record<string, unknown> = {},
  variant: Record<string, unknown> = {},
) {
  const created = await createProduct(
    db,
    shop,
    productInput(overrides, variant),
  );
  await addImageRow(db, created.id);
  return created;
}

async function published(
  shop: Shop,
  overrides: Record<string, unknown> = {},
  variant: Record<string, unknown> = {},
) {
  const created = await product(shop, overrides, variant);
  await publishProduct(db, shop, created.id);
  return created;
}

/** The maker name is unique per test, so searches return only this test's products. */
function tagged(extra: Record<string, unknown> = {}) {
  return { madeBy: `Maker ${createId()}`, ...extra };
}

/** A product with a "Small" and a "Large" variant, tagged for search. */
async function twoSizes(
  shop: Shop,
  tag: { madeBy: string },
  small: { initialStock: number; price: string },
  large: { initialStock: number; price: string },
) {
  const created = await product(
    shop,
    { initialStock: small.initialStock, ...tag },
    { price: small.price },
  );
  await updateVariant(db, shop, created.variants[0]?.id ?? "", {
    label: "Small",
  });
  const detail = await addVariant(
    db,
    shop,
    created.id,
    variantCreateSchema.parse({
      heightMm: 50,
      initialStock: large.initialStock,
      label: "Large",
      lengthMm: 100,
      price: large.price,
      sku: `LARGE-${createId().slice(0, 10)}`,
      weightGrams: 500,
      widthMm: 100,
    }),
  );
  const largeId = detail.variants.find((v) => v.label === "Large")?.id ?? "";
  return { created, largeId };
}

const query = (q: string, extra: Record<string, unknown> = {}) => ({
  page: 1,
  q,
  sort: "newest" as const,
  ...extra,
});

describe("searchStorefront", () => {
  test("excludes draft, unpublished, archived, held, sold-out, inactive-variant, hidden-category and suspended-shop products", async () => {
    const shop = await seedApprovedMerchant(db);
    const moderator = await admin();
    const tag = tagged();

    const good = await published(shop, tag, { price: "249.50" });
    await product(shop, tag); // draft
    const unpublished = await published(shop, tag);
    await unpublishProduct(db, shop, unpublished.id);
    const archived = await published(shop, tag);
    await archiveProduct(db, shop, archived.id);
    const held = await published(shop, tag);
    await holdProduct(db, moderator, held.id, { reason: "Under review." });
    await published(shop, { ...tag, initialStock: 0 }); // sold out

    // In stock only on a variant that is then switched off.
    const { created: switchedOff, largeId } = await twoSizes(
      shop,
      tag,
      { initialStock: 0, price: "399" },
      { initialStock: 5, price: "499" },
    );
    await publishProduct(db, shop, switchedOff.id);
    await updateVariant(db, shop, largeId, { isActive: false });

    const categoryId = await seedCategory(db);
    await published(shop, { ...tag, categoryId });
    await updateCategory(db, moderator, categoryId, { isActive: false });

    const suspended = await seedApprovedMerchant(db);
    await published(suspended, tag);
    await suspendMerchant(db, moderator, suspended.merchantId);

    const result = await searchStorefront(db, query(tag.madeBy));
    expect(result.items.map((item) => item.productId)).toEqual([good.id]);
    expect(result.items[0]).toMatchObject({
      priceFromPaise: 24_950,
      shopSlug: shop.slug,
      storeName: shop.storeName,
    });

    for (const hidden of [unpublished, archived, held]) {
      expect(await getStorefrontProduct(db, shop.slug, hidden.slug)).toBeNull();
    }
    const highlightIds = (await storefrontHighlights(db)).newest.map(
      (item) => item.productId,
    );
    expect(highlightIds).not.toContain(held.id);
    expect(highlightIds).not.toContain(archived.id);
  });

  test("price-from counts only in-stock active variants", async () => {
    const shop = await seedApprovedMerchant(db);
    const tag = tagged();
    const { created } = await twoSizes(
      shop,
      tag,
      { initialStock: 0, price: "99" },
      { initialStock: 3, price: "799" },
    );
    await publishProduct(db, shop, created.id);
    const result = await searchStorefront(db, query(tag.madeBy));
    expect(result.items.map((item) => item.priceFromPaise)).toEqual([79_900]);
  });

  test("filters by category, made and region, alone and combined", async () => {
    const shop = await seedApprovedMerchant(db);
    const tag = tagged();
    const categoryId = await seedCategory(db);
    const match = await published(shop, {
      ...tag,
      categoryId,
      madeHow: "HANDMADE",
      originState: "goa",
    });
    await published(shop, { ...tag, madeHow: "HOMEMADE", originState: "goa" });
    await published(shop, {
      ...tag,
      madeHow: "HANDMADE",
      originState: "kerala",
    });

    const ids = async (extra: Record<string, unknown>) =>
      (await searchStorefront(db, query(tag.madeBy, extra))).items.map(
        (item) => item.productId,
      );
    expect(await ids({ category: categoryId })).toEqual([match.id]);
    expect(await ids({ made: "handmade" })).toHaveLength(2);
    expect(await ids({ region: "goa" })).toHaveLength(2);
    expect(await ids({ made: "handmade", region: "goa" })).toEqual([match.id]);
  });

  test("q matches name, maker, place and composition, and wildcards match literally", async () => {
    const shop = await seedApprovedMerchant(db);
    const tag = tagged({ composition: `kokum ${createId()}` });
    const created = await published(shop, tag);
    const search = (q: string) => searchStorefront(db, query(q));
    expect((await search(tag.madeBy)).items.map((i) => i.productId)).toEqual([
      created.id,
    ]);
    expect(
      (await search(shop.storeName)).items.map((i) => i.productId),
    ).toContain(created.id);
    expect((await search("%")).total).toBe(0);
    expect((await search("_")).total).toBe(0);
  });

  test("sorts by price and paginates 24 per page", async () => {
    const shop = await seedApprovedMerchant(db);
    const tag = tagged();
    for (let index = 0; index < 25; index += 1) {
      await published(shop, tag, { price: String(100 + index) });
    }
    const asc = await searchStorefront(db, {
      ...query(tag.madeBy),
      sort: "price_asc",
    });
    expect(asc.total).toBe(25);
    expect(asc.items).toHaveLength(24);
    expect(asc.items[0]?.priceFromPaise).toBe(10_000);
    const second = await searchStorefront(db, {
      ...query(tag.madeBy),
      page: 2,
      sort: "price_desc",
    });
    expect(second.items).toHaveLength(1);
    expect(second.items[0]?.priceFromPaise).toBe(10_000);
  });

  test("region counts list states with products, sorted by name", async () => {
    const shop = await seedApprovedMerchant(db);
    await published(shop, tagged({ originState: "goa" }));
    const result = await searchStorefront(db, query(createId()));
    const names = result.regionCounts.map((region) => region.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(
      result.regionCounts.find((r) => r.slug === "goa")?.count,
    ).toBeGreaterThanOrEqual(1);
  });
});

describe("product and shop pages", () => {
  test("a product of a shop without a story is purchasable, not linkable, and the shop 404s", async () => {
    const shop = await seedApprovedMerchant(db, {}, { story: false });
    const created = await product(shop, tagged());
    await db
      .update(productsTable)
      .set({ publishedAt: new Date(), status: "PUBLISHED" })
      .where(eq(productsTable.id, created.id));

    const found = await getStorefrontProduct(db, shop.slug, created.slug);
    expect(found).not.toBeNull();
    expect(found?.shopLinkable).toBe(false);
    expect(await getStorefrontShop(db, shop.slug)).toBeNull();
  });

  test("a shop with a complete story lists its purchasable products", async () => {
    const shop = await seedApprovedMerchant(db);
    const created = await published(shop, tagged());
    const found = await getStorefrontShop(db, shop.slug);
    expect(found?.products.map((p) => p.productId)).toEqual([created.id]);
    expect(found?.products[0]?.shopLinkable).toBe(true);
  });

  test("an unpublished product has no page", async () => {
    const shop = await seedApprovedMerchant(db);
    const created = await product(shop, tagged());
    expect(await getStorefrontProduct(db, shop.slug, created.slug)).toBeNull();
  });

  test("highlights list the newest products and active categories", async () => {
    const shop = await seedApprovedMerchant(db);
    const created = await published(shop, tagged());
    const highlights = await storefrontHighlights(db);
    expect(highlights.newest.length).toBeLessThanOrEqual(3);
    expect(highlights.newest.map((item) => item.productId)).toContain(
      created.id,
    );
    expect(highlights.categories.map((c) => c.slug)).toContain(
      "handmade-gifts",
    );
  });
});

describe("cart variant lookup", () => {
  test("reports purchasable for active variants of purchasable products only", async () => {
    const shop = await seedApprovedMerchant(db);
    const { created, largeId } = await twoSizes(
      shop,
      tagged(),
      { initialStock: 3, price: "99" },
      { initialStock: 3, price: "199" },
    );
    await publishProduct(db, shop, created.id);
    const [info] = await getVariantsForCart(db, [largeId]);
    expect(info).toMatchObject({ purchasable: true, variantId: largeId });
    await updateVariant(db, shop, largeId, { isActive: false });
    const [inactive] = await getVariantsForCart(db, [largeId]);
    expect(inactive?.purchasable).toBe(false);
    expect(await getVariantsForCart(db, [createId()])).toEqual([]);
  });

  test("a suspended shop is not linkable, so the cart never links to its 404 page", async () => {
    const shop = await seedApprovedMerchant(db);
    const created = await published(shop, tagged());
    const variantId = created.variants[0]?.id ?? "";
    const [before] = await getVariantsForCart(db, [variantId]);
    expect(before?.shopLinkable).toBe(true);

    await suspendMerchant(db, await admin(), shop.merchantId);
    const [after] = await getVariantsForCart(db, [variantId]);
    expect(after?.shopLinkable).toBe(false);
    expect(await getStorefrontShop(db, shop.slug)).toBeNull();
  });

  test("a product with no stock left has no page, so its lines are not linkable", async () => {
    const shop = await seedApprovedMerchant(db);
    const { created, largeId } = await twoSizes(
      shop,
      tagged(),
      { initialStock: 2, price: "99" },
      { initialStock: 2, price: "199" },
    );
    await publishProduct(db, shop, created.id);
    const smallId = created.variants[0]?.id ?? "";
    const linkable = async () =>
      (await getVariantsForCart(db, [smallId, largeId]))
        .map((info) => [info.variantLabel, info.productLinkable])
        .sort();

    expect(await linkable()).toEqual([
      ["Large", true],
      ["Small", true],
    ]);

    await adjustStock(db, shop, smallId, { delta: -2, reason: "DAMAGED" });
    // The small size is sold out, but the product page still sells the large one.
    expect(await linkable()).toEqual([
      ["Large", true],
      ["Small", true],
    ]);
    expect(
      await getStorefrontProduct(db, shop.slug, created.slug),
    ).not.toBeNull();

    await adjustStock(db, shop, largeId, { delta: -2, reason: "DAMAGED" });
    expect(await linkable()).toEqual([
      ["Large", false],
      ["Small", false],
    ]);
    expect(await getStorefrontProduct(db, shop.slug, created.slug)).toBeNull();
  });
});
