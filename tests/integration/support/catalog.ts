import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";

import type { Database } from "~/db";

import {
  categoriesTable,
  merchantsTable,
  merchantStoryImagesTable,
  productImagesTable,
} from "~/db/schema";
import { createProduct } from "~/modules/catalog/application/products";
import { publishProduct } from "~/modules/catalog/application/status";
import { productCreateSchema } from "~/modules/catalog/presentation/schemas";
import { submitMerchant } from "~/modules/merchants/application/profile";
import { approveMerchant } from "~/modules/merchants/application/review";

import { testAdmin } from "../../support/merchant-fixtures";
import { seedMerchant, seedUser } from "./merchants";

/** An image row without a stored file, for tests that only need one to exist. */
export async function addImageRow(db: Database, productId: string) {
  const id = createId();
  await db.insert(productImagesTable).values({
    alt: "Test image",
    bytes: 38,
    contentType: "image/webp",
    height: 2,
    id,
    productId,
    storageKey: `test/${id}.webp`,
    url: `/api/v1/images/test/${id}.webp`,
    width: 3,
  });
  return id;
}

/** Gives a shop a complete story: text, place, state and one photo row. */
export async function completeStory(db: Database, merchantId: string) {
  await db
    .update(merchantsTable)
    .set({
      homePlace: "Malvan",
      homeState: "maharashtra",
      story: "We roast cashews in our courtyard kitchen. ".repeat(5).trim(),
    })
    .where(eq(merchantsTable.id, merchantId));
  const id = createId();
  await db.insert(merchantStoryImagesTable).values({
    alt: "Makers at work",
    bytes: 38,
    contentType: "image/webp",
    height: 2,
    id,
    merchantId,
    storageKey: `test/${id}.webp`,
    url: `/api/v1/images/test/${id}.webp`,
    width: 3,
  });
}

/**
 * Parsed product input, as a route handler would pass it to the service.
 * Includes a complete story unless overridden.
 */
export function productInput(
  overrides: Partial<Record<string, unknown>> = {},
  variant: Partial<Record<string, unknown>> = {},
) {
  return productCreateSchema.parse({
    ...storyInput(),
    categoryId: "cat_handmade_gifts",
    initialStock: 10,
    name: `Clay diya set ${createId().slice(0, 6)}`,
    variant: {
      heightMm: 50,
      lengthMm: 100,
      price: "399",
      sku: `SKU-${createId().slice(0, 10)}`,
      weightGrams: 500,
      widthMm: 100,
      ...variant,
    },
    ...overrides,
  });
}

/** A published product with one variant at `price` rupees and `stock` units. */
export async function publishedProduct(
  db: Database,
  shop: Awaited<ReturnType<typeof seedApprovedMerchant>>,
  { price = "100", stock = 5 }: { price?: string; stock?: number } = {},
) {
  const created = await createProduct(
    db,
    shop,
    productInput({ initialStock: stock }, { price }),
  );
  await addImageRow(db, created.id);
  await publishProduct(db, shop, created.id);
  return {
    name: created.name,
    productId: created.id,
    slug: created.slug,
    variantId: created.variants[0]?.id ?? "",
  };
}

/**
 * A shop that went through submit and approval, ready to sell; with a
 * complete story unless `story: false`.
 */
export async function seedApprovedMerchant(
  db: Database,
  overrides: Parameters<typeof seedMerchant>[1] = {},
  { story = true }: { story?: boolean } = {},
) {
  const merchant = await seedMerchant(db, overrides);
  if (story) {
    await completeStory(db, merchant.merchantId);
  }
  await submitMerchant(db, merchant);
  await approveMerchant(
    db,
    testAdmin(await seedUser(db, "admin")),
    merchant.merchantId,
  );
  return { ...merchant, status: "APPROVED" as const };
}

/** An active category with a unique name; returns its id. */
export async function seedCategory(
  db: Database,
  name = `Category ${createId()}`,
): Promise<string> {
  const id = createId();
  await db
    .insert(categoriesTable)
    .values({ id, name, slug: id, sortOrder: 1000 });
  return id;
}

/** A filled-in product story (spec §4.1). */
export function storyInput() {
  return {
    composition: "Cashews, jaggery, cardamom",
    madeBy: "Lakshmi Sawant and her daughters",
    madeHow: "HOMEMADE",
    originPlace: "Malvan",
    originState: "maharashtra",
  };
}
