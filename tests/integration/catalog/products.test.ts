import { eq } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import {
  categoriesTable,
  productsTable,
  productVariantsTable,
} from "~/db/schema";
import {
  adjustStock,
  listStockMovements,
} from "~/modules/catalog/application/inventory";
import {
  catalogCounts,
  createProduct,
  getProduct,
  listProducts,
  updateProduct,
} from "~/modules/catalog/application/products";
import {
  addVariant,
  updateVariant,
} from "~/modules/catalog/application/variants";
import {
  variantCreateSchema,
  variantPatchSchema,
} from "~/modules/catalog/presentation/schemas";
import { NotFoundError, ValidationError } from "~/platform/errors";

import {
  productInput,
  seedApprovedMerchant,
  seedCategory,
} from "../support/catalog";
import { connectTestDb } from "../support/db";

const { close, db } = connectTestDb();
afterAll(close);

const secondVariant = (overrides: Record<string, unknown> = {}) =>
  variantCreateSchema.parse({
    heightMm: 50,
    initialStock: 4,
    label: "250 g",
    lengthMm: 100,
    price: "699",
    sku: `V2-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    weightGrams: 250,
    widthMm: 100,
    ...overrides,
  });

describe("products", () => {
  test("creating a product makes a draft, a default variant, inventory and an INITIAL movement atomically", async () => {
    const shop = await seedApprovedMerchant(db);
    const product = await createProduct(db, shop, productInput());
    expect(product).toMatchObject({
      publishBlockers: ["image"],
      status: "DRAFT",
    });
    expect(product.variants).toHaveLength(1);
    const [variant] = product.variants;
    expect(variant).toMatchObject({
      available: 10,
      label: null,
      pricePaise: 39900,
      reserved: 0,
    });
    const movements = await listStockMovements(db, shop, variant?.id ?? "");
    expect(movements).toMatchObject([
      { availableAfter: 10, delta: 10, reason: "INITIAL" },
    ]);
  });

  test("zero initial stock records no movement", async () => {
    const shop = await seedApprovedMerchant(db);
    const product = await createProduct(
      db,
      shop,
      productInput({ initialStock: 0 }),
    );
    const variantId = product.variants[0]?.id ?? "";
    expect(await listStockMovements(db, shop, variantId)).toEqual([]);
    expect(product.variants[0]?.available).toBe(0);
  });

  test("a bad category leaves nothing behind", async () => {
    const shop = await seedApprovedMerchant(db);
    const hidden = await seedCategory(db);
    await db
      .update(categoriesTable)
      .set({ isActive: false })
      .where(eq(categoriesTable.id, hidden));
    for (const categoryId of ["cat_missing", hidden]) {
      await expect(
        createProduct(db, shop, productInput({ categoryId })),
      ).rejects.toBeInstanceOf(ValidationError);
    }
    const rows = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.merchantId, shop.merchantId));
    expect(rows).toEqual([]);
  });

  test("the same SKU is fine in two shops but taken within one", async () => {
    const first = await seedApprovedMerchant(db);
    const second = await seedApprovedMerchant(db);
    const sku = `SHARED-${Date.now()}`;
    await createProduct(db, first, productInput({}, { sku }));
    await createProduct(db, second, productInput({}, { sku }));
    await expect(
      createProduct(db, first, productInput({}, { sku: sku.toLowerCase() })),
    ).rejects.toMatchObject({
      code: "sku_taken",
      details: { sku: ["You already use this SKU."] },
    });
  });

  test("another shop's product, variant and movements are 404 and unchanged", async () => {
    const owner = await seedApprovedMerchant(db);
    const other = await seedApprovedMerchant(db);
    const product = await createProduct(db, owner, productInput());
    const variantId = product.variants[0]?.id ?? "";
    const attempts = [
      () => getProduct(db, other, product.id),
      () => updateProduct(db, other, product.id, { name: "Stolen" }),
      () => addVariant(db, other, product.id, secondVariant()),
      () =>
        updateVariant(
          db,
          other,
          variantId,
          variantPatchSchema.parse({ price: "1" }),
        ),
      () => adjustStock(db, other, variantId, { delta: -1, reason: "DAMAGED" }),
      () => listStockMovements(db, other, variantId),
    ];
    for (const attempt of attempts) {
      await expect(attempt()).rejects.toBeInstanceOf(NotFoundError);
    }
    expect(await getProduct(db, owner, product.id)).toMatchObject({
      name: product.name,
      variants: [{ available: 10, pricePaise: 39900 }],
    });
    expect(await listProducts(db, other, {})).toEqual([]);
  });

  test("a second variant requires labels", async () => {
    const shop = await seedApprovedMerchant(db);
    const product = await createProduct(db, shop, productInput());
    await expect(
      addVariant(db, shop, product.id, secondVariant()),
    ).rejects.toMatchObject({ code: "label_required" });
    const defaultId = product.variants[0]?.id ?? "";
    await updateVariant(
      db,
      shop,
      defaultId,
      variantPatchSchema.parse({ label: "500 g" }),
    );
    const detail = await addVariant(db, shop, product.id, secondVariant());
    expect(detail.variants.map((v) => v.label)).toEqual(["500 g", "250 g"]);
    expect(detail.variants[1]?.available).toBe(4);
  });

  test("the last active variant of a published product cannot be deactivated", async () => {
    const shop = await seedApprovedMerchant(db);
    const product = await createProduct(db, shop, productInput());
    await db
      .update(productsTable)
      .set({ status: "PUBLISHED" })
      .where(eq(productsTable.id, product.id));
    const variantId = product.variants[0]?.id ?? "";
    await expect(
      updateVariant(db, shop, variantId, { isActive: false }),
    ).rejects.toMatchObject({ code: "last_variant" });
    const [row] = await db
      .select()
      .from(productVariantsTable)
      .where(eq(productVariantsTable.id, variantId));
    expect(row?.isActive).toBe(true);
  });

  test("a price change above the stored MRP is refused on the MRP", async () => {
    const shop = await seedApprovedMerchant(db);
    const product = await createProduct(
      db,
      shop,
      productInput({}, { mrp: "450" }),
    );
    const variantId = product.variants[0]?.id ?? "";
    await expect(
      updateVariant(
        db,
        shop,
        variantId,
        variantPatchSchema.parse({ price: "500" }),
      ),
    ).rejects.toMatchObject({
      code: "validation_failed",
      details: { mrp: ["Price cannot be higher than the declared MRP."] },
    });
    const updated = await updateVariant(
      db,
      shop,
      variantId,
      variantPatchSchema.parse({ mrp: "", price: "500" }),
    );
    expect(updated).toMatchObject({
      declaredMrpPaise: null,
      pricePaise: 50000,
    });
  });

  test("archived products cannot be edited", async () => {
    const shop = await seedApprovedMerchant(db);
    const product = await createProduct(db, shop, productInput());
    await db
      .update(productsTable)
      .set({ status: "ARCHIVED" })
      .where(eq(productsTable.id, product.id));
    await expect(
      updateProduct(db, shop, product.id, { name: "New name" }),
    ).rejects.toMatchObject({ code: "archived" });
    await expect(
      addVariant(db, shop, product.id, secondVariant()),
    ).rejects.toMatchObject({ code: "archived" });
  });

  test("slug is locked after draft", async () => {
    const shop = await seedApprovedMerchant(db);
    const product = await createProduct(db, shop, productInput());
    const renamed = await updateProduct(db, shop, product.id, {
      slug: "diya-set",
    });
    expect(renamed.slug).toBe("diya-set");
    const other = await createProduct(db, shop, productInput());
    await expect(
      updateProduct(db, shop, other.id, { slug: "diya-set" }),
    ).rejects.toMatchObject({ code: "slug_taken" });
    await db
      .update(productsTable)
      .set({ status: "UNPUBLISHED" })
      .where(eq(productsTable.id, product.id));
    await expect(
      updateProduct(db, shop, product.id, { slug: "new-slug" }),
    ).rejects.toMatchObject({ code: "slug_locked" });
  });

  test("two products with the same name get distinct slugs", async () => {
    const shop = await seedApprovedMerchant(db);
    const first = await createProduct(
      db,
      shop,
      productInput({ name: "Kaju katli" }),
    );
    const second = await createProduct(
      db,
      shop,
      productInput({ name: "Kaju katli" }),
    );
    expect(first.slug).toBe("kaju-katli");
    expect(second.slug).toMatch(/^kaju-katli-[a-z0-9]+$/);
  });

  test("listProducts searches name and SKU and hides archived unless asked", async () => {
    const shop = await seedApprovedMerchant(db);
    const diya = await createProduct(
      db,
      shop,
      productInput({ name: "Brass diya" }, { sku: `FIND-ME-${Date.now()}` }),
    );
    const archived = await createProduct(
      db,
      shop,
      productInput({ name: "Old diya" }),
    );
    await db
      .update(productsTable)
      .set({ status: "ARCHIVED" })
      .where(eq(productsTable.id, archived.id));
    expect(
      (await listProducts(db, shop, { q: "brass" })).map((p) => p.id),
    ).toEqual([diya.id]);
    expect(
      (await listProducts(db, shop, { q: "find-me" })).map((p) => p.id),
    ).toEqual([diya.id]);
    expect((await listProducts(db, shop, {})).map((p) => p.id)).toEqual([
      diya.id,
    ]);
    expect(
      (await listProducts(db, shop, { status: "ARCHIVED" })).map((p) => p.id),
    ).toEqual([archived.id]);
    expect((await listProducts(db, shop, {}))[0]).toMatchObject({
      categoryName: "Handmade gifts",
      coverImageUrl: null,
      lowStock: false,
      priceFromPaise: 39900,
      totalAvailable: 10,
    });
  });

  test("catalogCounts counts by status, out of stock and low stock (≤ 5)", async () => {
    const shop = await seedApprovedMerchant(db);
    await createProduct(db, shop, productInput({ initialStock: 0 }));
    await createProduct(db, shop, productInput({ initialStock: 3 }));
    const healthy = await createProduct(
      db,
      shop,
      productInput({ initialStock: 25 }),
    );
    await db
      .update(productsTable)
      .set({ status: "PUBLISHED" })
      .where(eq(productsTable.id, healthy.id));
    const counts = await catalogCounts(db, shop);
    expect(counts.byStatus).toMatchObject({
      ARCHIVED: 0,
      DRAFT: 2,
      PUBLISHED: 1,
      UNPUBLISHED: 0,
    });
    expect(counts).toMatchObject({ lowStock: 1, outOfStock: 1 });
  });
});
