import { afterAll, expect, test } from "vitest";

import { holdProduct } from "~/modules/catalog/application/admin";
import { updateCategory } from "~/modules/catalog/application/categories";
import { createProduct } from "~/modules/catalog/application/products";
import { listPurchasableProducts } from "~/modules/catalog/application/purchasable";
import {
  archiveProduct,
  publishProduct,
  unpublishProduct,
} from "~/modules/catalog/application/status";
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

/** A product whose default variant is labelled "Small", plus a "Large" one. */
async function twoSizes(
  shop: Shop,
  small: { initialStock: number; price: string },
  large: { initialStock: number; price: string },
) {
  const created = await product(
    shop,
    { initialStock: small.initialStock },
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
      sku: `LARGE-${created.id.slice(0, 10)}`,
      weightGrams: 500,
      widthMm: 100,
    }),
  );
  const largeId = detail.variants.find((v) => v.label === "Large")?.id ?? "";
  return { created, largeId };
}

test("purchasable excludes draft, unpublished, archived, held, out-of-stock, inactive-variant, inactive-category and suspended-shop products", async () => {
  const shop = await seedApprovedMerchant(db);
  const moderator = await admin();

  const good = await published(shop, {}, { price: "249.50" });
  await product(shop); // draft
  const unpublished = await published(shop);
  await unpublishProduct(db, shop, unpublished.id);
  const archived = await published(shop);
  await archiveProduct(db, shop, archived.id);
  const held = await published(shop);
  await holdProduct(db, moderator, held.id, { reason: "Under review." });
  await published(shop, { initialStock: 0 }); // out of stock

  // In stock only on a variant that was then switched off.
  const { created: switchedOff, largeId } = await twoSizes(
    shop,
    { initialStock: 0, price: "399" },
    { initialStock: 5, price: "499" },
  );
  await publishProduct(db, shop, switchedOff.id);
  await updateVariant(db, shop, largeId, { isActive: false });

  const categoryId = await seedCategory(db);
  await published(shop, { categoryId });
  await updateCategory(db, moderator, categoryId, { isActive: false });

  const suspendedShop = await seedApprovedMerchant(db);
  await published(suspendedShop);
  await suspendMerchant(db, moderator, suspendedShop.merchantId);

  const listed = await listPurchasableProducts(db, {
    merchantId: shop.merchantId,
  });
  expect(listed).toEqual([
    {
      categorySlug: "handmade-gifts",
      coverImageUrl: expect.stringMatching(/^\/api\/v1\/images\/test\//),
      merchantSlug: shop.slug,
      name: good.name,
      priceFromPaise: 24_950,
      productId: good.id,
      slug: good.slug,
      storeName: shop.storeName,
    },
  ]);
  expect(
    await listPurchasableProducts(db, { merchantId: suspendedShop.merchantId }),
  ).toEqual([]);
});

test("price-from counts only in-stock active variants", async () => {
  const shop = await seedApprovedMerchant(db);
  const { created } = await twoSizes(
    shop,
    { initialStock: 0, price: "99" },
    { initialStock: 3, price: "799" },
  );
  await publishProduct(db, shop, created.id);
  const [listed] = await listPurchasableProducts(db, {
    merchantId: shop.merchantId,
  });
  expect(listed?.priceFromPaise).toBe(79_900);
});

test("filters by category slug and honours the limit", async () => {
  const shop = await seedApprovedMerchant(db);
  const categoryId = await seedCategory(db);
  const inCategory = await published(shop, { categoryId });
  await published(shop);
  await published(shop);
  const byCategory = await listPurchasableProducts(db, {
    categorySlug: categoryId,
    merchantId: shop.merchantId,
  });
  expect(byCategory.map((p) => p.productId)).toEqual([inCategory.id]);
  expect(
    await listPurchasableProducts(db, {
      limit: 2,
      merchantId: shop.merchantId,
    }),
  ).toHaveLength(2);
});

test("deactivating the category of a published product removes it from purchasable and blocks republish", async () => {
  const shop = await seedApprovedMerchant(db);
  const categoryId = await seedCategory(db);
  const created = await published(shop, { categoryId });
  expect(
    (await listPurchasableProducts(db, { merchantId: shop.merchantId })).map(
      (p) => p.productId,
    ),
  ).toEqual([created.id]);
  await updateCategory(db, await admin(), categoryId, { isActive: false });
  expect(
    await listPurchasableProducts(db, { merchantId: shop.merchantId }),
  ).toEqual([]);
  await unpublishProduct(db, shop, created.id);
  await expect(publishProduct(db, shop, created.id)).rejects.toMatchObject({
    code: "not_publishable",
    details: { missing: ["category"] },
  });
});
