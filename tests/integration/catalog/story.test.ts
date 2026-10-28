import { eq } from "drizzle-orm";
import { afterAll, expect, test } from "vitest";

import { productsTable } from "~/db/schema";
import {
  createProduct,
  getProduct,
  updateProduct,
} from "~/modules/catalog/application/products";
import { publishProduct } from "~/modules/catalog/application/status";
import { productPatchSchema } from "~/modules/catalog/presentation/schemas";

import {
  addImageRow,
  completeStory,
  productInput,
  seedApprovedMerchant,
} from "../support/catalog";
import { connectTestDb } from "../support/db";

const { close, db } = connectTestDb();
afterAll(close);

const noStory = {
  composition: undefined,
  madeBy: undefined,
  madeHow: undefined,
  originPlace: undefined,
  originState: undefined,
};

test("publishing needs every story field and a complete shop story", async () => {
  const shop = await seedApprovedMerchant(db, {}, { story: false });
  const product = await createProduct(db, shop, productInput(noStory));
  await addImageRow(db, product.id);
  await expect(publishProduct(db, shop, product.id)).rejects.toMatchObject({
    code: "not_publishable",
    details: {
      missing: ["origin", "made_by", "made_how", "composition", "shop_story"],
    },
    status: 409,
  });

  await updateProduct(
    db,
    shop,
    product.id,
    productPatchSchema.parse({
      composition: "Cashews, jaggery, cardamom",
      madeBy: "Lakshmi Sawant",
      madeHow: "HOMEMADE",
      originPlace: "Malvan",
      originState: "maharashtra",
    }),
  );
  await expect(publishProduct(db, shop, product.id)).rejects.toMatchObject({
    details: { missing: ["shop_story"] },
  });

  await completeStory(db, shop.merchantId);
  expect((await publishProduct(db, shop, product.id)).status).toBe("PUBLISHED");
  const detail = await getProduct(db, shop, product.id);
  expect(detail).toMatchObject({
    composition: "Cashews, jaggery, cardamom",
    madeBy: "Lakshmi Sawant",
    madeHow: "HOMEMADE",
    originPlace: "Malvan",
    originState: "maharashtra",
    publishBlockers: [],
  });
});

test("only a place without a state still blocks on origin", async () => {
  const shop = await seedApprovedMerchant(db);
  const product = await createProduct(
    db,
    shop,
    productInput({ originState: undefined }),
  );
  expect((await getProduct(db, shop, product.id)).publishBlockers).toContain(
    "origin",
  );
});

test("a published product cannot lose a story field", async () => {
  const shop = await seedApprovedMerchant(db);
  const product = await createProduct(db, shop, productInput());
  await addImageRow(db, product.id);
  await publishProduct(db, shop, product.id);
  await expect(
    updateProduct(
      db,
      shop,
      product.id,
      productPatchSchema.parse({ madeBy: "" }),
    ),
  ).rejects.toMatchObject({ code: "story_required", status: 409 });
  const changed = await updateProduct(
    db,
    shop,
    product.id,
    productPatchSchema.parse({ madeBy: "Someone else" }),
  );
  expect(changed.madeBy).toBe("Someone else");
});

test("a product published without a story stays published and can still be edited", async () => {
  const shop = await seedApprovedMerchant(db);
  const product = await createProduct(db, shop, productInput(noStory));
  await db
    .update(productsTable)
    .set({ publishedAt: new Date(), status: "PUBLISHED" })
    .where(eq(productsTable.id, product.id));
  const renamed = await updateProduct(
    db,
    shop,
    product.id,
    productPatchSchema.parse({ madeBy: "", name: "Renamed chikki" }),
  );
  expect(renamed.status).toBe("PUBLISHED");
  expect(renamed.publishBlockers).toEqual(
    expect.arrayContaining(["origin", "made_by", "made_how", "composition"]),
  );
});

test("composition label follows the category", async () => {
  const shop = await seedApprovedMerchant(db);
  const gift = await createProduct(
    db,
    shop,
    productInput({ categoryId: "cat_handmade_gifts" }),
  );
  const sweet = await createProduct(
    db,
    shop,
    productInput({ categoryId: "cat_snacks_and_sweets" }),
  );
  expect((await getProduct(db, shop, gift.id)).compositionLabel).toBe(
    "MATERIALS",
  );
  expect((await getProduct(db, shop, sweet.id)).compositionLabel).toBe(
    "INGREDIENTS",
  );
});
