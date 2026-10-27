import { eq } from "drizzle-orm";
import { afterAll, expect, test } from "vitest";

import { productsTable } from "~/db/schema";
import {
  holdProduct,
  listProductsForAdmin,
  releaseProduct,
} from "~/modules/catalog/application/admin";
import { updateCategory } from "~/modules/catalog/application/categories";
import {
  createProduct,
  getProduct,
} from "~/modules/catalog/application/products";
import {
  archiveProduct,
  publishProduct,
  unpublishProduct,
} from "~/modules/catalog/application/status";
import { holdSchema } from "~/modules/catalog/presentation/schemas";
import { submitMerchant } from "~/modules/merchants/application/profile";
import { suspendMerchant } from "~/modules/merchants/application/review";
import { ForbiddenError, NotFoundError } from "~/platform/errors";

import { testAdmin } from "../../support/merchant-fixtures";
import {
  addImageRow,
  productInput,
  seedApprovedMerchant,
  seedCategory,
} from "../support/catalog";
import { connectTestDb } from "../support/db";
import { seedMerchant, seedUser } from "../support/merchants";

const { close, db } = connectTestDb();
afterAll(close);

const admin = async () => testAdmin(await seedUser(db, "admin"));

async function publishable(overrides: Record<string, unknown> = {}) {
  const shop = await seedApprovedMerchant(db);
  const product = await createProduct(db, shop, productInput(overrides));
  await addImageRow(db, product.id);
  return { product, shop };
}

test("publishing needs a category, a priced variant and an image", async () => {
  const shop = await seedApprovedMerchant(db);
  const categoryId = await seedCategory(db);
  const product = await createProduct(db, shop, productInput({ categoryId }));
  await updateCategory(db, await admin(), categoryId, { isActive: false });
  await expect(publishProduct(db, shop, product.id)).rejects.toMatchObject({
    code: "not_publishable",
    details: { missing: ["category", "image"] },
    message: "Add what is missing before publishing.",
    status: 409,
  });
  expect((await getProduct(db, shop, product.id)).status).toBe("DRAFT");
});

test("publish, unpublish, republish, archive", async () => {
  const { product, shop } = await publishable();
  const published = await publishProduct(db, shop, product.id);
  expect(published.status).toBe("PUBLISHED");
  const [row] = await db
    .select({ publishedAt: productsTable.publishedAt })
    .from(productsTable)
    .where(eq(productsTable.id, product.id));
  expect(row?.publishedAt).toBeInstanceOf(Date);
  expect((await unpublishProduct(db, shop, product.id)).status).toBe(
    "UNPUBLISHED",
  );
  expect((await publishProduct(db, shop, product.id)).status).toBe("PUBLISHED");
  expect((await archiveProduct(db, shop, product.id)).status).toBe("ARCHIVED");
});

test("archived is final", async () => {
  const { product, shop } = await publishable();
  await archiveProduct(db, shop, product.id);
  for (const action of [publishProduct, unpublishProduct, archiveProduct]) {
    await expect(action(db, shop, product.id)).rejects.toMatchObject({
      code: "invalid_transition",
      status: 409,
    });
  }
});

test("a draft cannot be unpublished", async () => {
  const { product, shop } = await publishable();
  await expect(unpublishProduct(db, shop, product.id)).rejects.toMatchObject({
    code: "invalid_transition",
  });
});

test("publishing twice at once: one wins", async () => {
  const { product, shop } = await publishable();
  const results = await Promise.allSettled([
    publishProduct(db, shop, product.id),
    publishProduct(db, shop, product.id),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const [rejected] = results.filter((r) => r.status === "rejected");
  expect(rejected?.reason).toMatchObject({ code: "invalid_transition" });
});

test("publish and archive at once: archived wins, never published after", async () => {
  const { product, shop } = await publishable();
  const [publish] = await Promise.allSettled([
    publishProduct(db, shop, product.id),
    archiveProduct(db, shop, product.id),
  ]);
  if (publish.status === "rejected") {
    expect(publish.reason).toMatchObject({ code: "invalid_transition" });
  }
  expect((await getProduct(db, shop, product.id)).status).toBe("ARCHIVED");
});

test("another shop's product is 404", async () => {
  const { product } = await publishable();
  const other = await seedApprovedMerchant(db);
  for (const action of [publishProduct, unpublishProduct, archiveProduct]) {
    await expect(action(db, other, product.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  }
});

test("a draft shop cannot publish", async () => {
  const merchant = await seedMerchant(db);
  await submitMerchant(db, merchant);
  const shop = { ...merchant, status: "SUBMITTED" as const };
  const product = await createProduct(db, shop, productInput());
  await addImageRow(db, product.id);
  await expect(publishProduct(db, shop, product.id)).rejects.toBeInstanceOf(
    ForbiddenError,
  );
});

test("a shop suspended since sign-in cannot publish", async () => {
  const { product, shop } = await publishable();
  await suspendMerchant(db, await admin(), shop.merchantId);
  // The context still says APPROVED; publishing re-reads the shop.
  await expect(publishProduct(db, shop, product.id)).rejects.toBeInstanceOf(
    ForbiddenError,
  );
});

test("an admin hold unpublishes, blocks republish, shows the reason, and release leaves it unpublished", async () => {
  const { product, shop } = await publishable();
  await publishProduct(db, shop, product.id);
  const moderator = await admin();
  const reason = "Photos show a different product.";
  const held = await holdProduct(db, moderator, product.id, { reason });
  expect(held).toMatchObject({
    adminHoldReason: reason,
    merchantId: shop.merchantId,
    status: "UNPUBLISHED",
    storeName: expect.any(String),
  });
  const [row] = await db
    .select({ at: productsTable.adminHoldAt, by: productsTable.adminHoldBy })
    .from(productsTable)
    .where(eq(productsTable.id, product.id));
  expect(row).toEqual({ at: expect.any(Date), by: moderator.id });
  await expect(publishProduct(db, shop, product.id)).rejects.toMatchObject({
    code: "admin_hold",
    status: 409,
  });
  expect((await getProduct(db, shop, product.id)).adminHoldReason).toBe(reason);

  const released = await releaseProduct(db, moderator, product.id);
  expect(released).toMatchObject({
    adminHoldReason: null,
    status: "UNPUBLISHED",
  });
  await expect(releaseProduct(db, moderator, product.id)).rejects.toMatchObject(
    {
      code: "no_hold",
      status: 409,
    },
  );
  expect((await publishProduct(db, shop, product.id)).status).toBe("PUBLISHED");
});

test("a held product can still be archived", async () => {
  const { product, shop } = await publishable();
  await publishProduct(db, shop, product.id);
  await holdProduct(db, await admin(), product.id, { reason: "Needs review." });
  expect((await archiveProduct(db, shop, product.id)).status).toBe("ARCHIVED");
});

test("only published products can be held; unknown ids are 404", async () => {
  const { product } = await publishable();
  const moderator = await admin();
  await expect(
    holdProduct(db, moderator, product.id, { reason: "Not live yet." }),
  ).rejects.toMatchObject({ code: "invalid_transition" });
  await expect(
    holdProduct(db, moderator, "missing", { reason: "Nothing here." }),
  ).rejects.toBeInstanceOf(NotFoundError);
  await expect(releaseProduct(db, moderator, "missing")).rejects.toBeInstanceOf(
    NotFoundError,
  );
});

test("admins list products across shops, filtered by status", async () => {
  const first = await publishable();
  const second = await publishable();
  await publishProduct(db, second.shop, second.product.id);
  const moderator = await admin();
  const published = await listProductsForAdmin(db, moderator, {
    status: "PUBLISHED",
  });
  const ids = published.map((product) => product.id);
  expect(ids).toContain(second.product.id);
  expect(ids).not.toContain(first.product.id);
  expect(published.find((p) => p.id === second.product.id)).toMatchObject({
    merchantId: second.shop.merchantId,
    storeName: expect.any(String),
  });
  const all = (await listProductsForAdmin(db, moderator, {})).map((p) => p.id);
  expect(all).toEqual(
    expect.arrayContaining([first.product.id, second.product.id]),
  );
});

test("a hold reason is 5 to 500 characters", () => {
  expect(holdSchema.safeParse({ reason: "  Bad  " }).success).toBe(false);
  expect(holdSchema.parse({ reason: "  Wrong item  " })).toEqual({
    reason: "Wrong item",
  });
  expect(holdSchema.safeParse({ reason: "x".repeat(501) }).success).toBe(false);
});
