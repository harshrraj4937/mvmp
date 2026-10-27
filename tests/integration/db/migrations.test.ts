import { createId } from "@paralleldrive/cuid2";
import { asc, like } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, describe, expect, inject, test } from "vitest";

import { runMigrations } from "~/db/migrate";
import { categoriesTable } from "~/db/schema";

import { connectTestDb } from "../support/db";
import { seedMerchant } from "../support/merchants";

async function listPublicTables(databaseUrl: string): Promise<string[]> {
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const rows = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public'
    `;
    return rows.map((row) => row.table_name);
  } finally {
    await sql.end();
  }
}

test("baseline creates auth and uploads tables and no Polar tables", async () => {
  const tables = await listPublicTables(inject("databaseUrl"));
  expect(tables).toEqual(
    expect.arrayContaining([
      "user",
      "session",
      "account",
      "verification",
      "two_factor",
      "uploads",
    ]),
  );
  expect(tables.filter((table) => table.startsWith("polar"))).toEqual([]);
});

test("Phase 2 adds the merchant tables", async () => {
  const tables = await listPublicTables(inject("databaseUrl"));
  expect(tables).toEqual(
    expect.arrayContaining([
      "merchants",
      "merchant_members",
      "merchant_pickup_locations",
    ]),
  );
});

test("running migrations twice is a no-op", async () => {
  await expect(runMigrations(inject("databaseUrl"))).resolves.toBeUndefined();
});

test("Phase 3 adds the catalog tables", async () => {
  const tables = await listPublicTables(inject("databaseUrl"));
  expect(tables).toEqual(
    expect.arrayContaining([
      "categories",
      "products",
      "product_variants",
      "product_images",
      "inventory",
      "inventory_movements",
    ]),
  );
});

describe("catalog constraints", () => {
  const { close, db } = connectTestDb();
  const sql = postgres(inject("databaseUrl"), { max: 1 });

  afterAll(async () => {
    await close();
    await sql.end();
  });

  test("the seven categories are seeded in order", async () => {
    const rows = await db
      .select({ id: categoriesTable.id, name: categoriesTable.name })
      .from(categoriesTable)
      // Other test files add categories to the same database.
      .where(like(categoriesTable.id, "cat\\_%"))
      .orderBy(asc(categoriesTable.sortOrder));
    expect(rows.map((row) => row.name)).toEqual([
      "Regional packaged food",
      "Snacks and sweets",
      "Cashews and dry fruits",
      "Art and handicrafts",
      "Home and festive decor",
      "Handmade gifts",
      "Other regional products",
    ]);
    expect(rows[0]?.id).toBe("cat_regional_packaged_food");
  });

  async function seedVariant() {
    const merchant = await seedMerchant(db);
    const productId = createId();
    const variantId = createId();
    await sql`
      insert into products (id, merchant_id, category_id, name, slug)
      values (${productId}, ${merchant.merchantId}, 'cat_handmade_gifts', 'Diya set', ${productId})
    `;
    await sql`
      insert into product_variants (id, product_id, merchant_id, sku, price_paise, weight_grams, length_mm, width_mm, height_mm)
      values (${variantId}, ${productId}, ${merchant.merchantId}, ${`SKU-${variantId}`}, 39900, 500, 100, 100, 50)
    `;
    return { merchantId: merchant.merchantId, productId, variantId };
  }

  test("refuses negative stock", async () => {
    const { variantId } = await seedVariant();
    await expect(
      sql`insert into inventory (variant_id, available) values (${variantId}, -1)`,
    ).rejects.toMatchObject({
      constraint_name: "inventory_available_nonnegative",
    });
  });

  test("refuses an MRP below the selling price", async () => {
    const { merchantId, productId } = await seedVariant();
    await expect(
      sql`
        insert into product_variants (id, product_id, merchant_id, sku, price_paise, declared_mrp_paise, weight_grams, length_mm, width_mm, height_mm)
        values (${createId()}, ${productId}, ${merchantId}, 'MRP-LOW', 39900, 39800, 500, 100, 100, 50)
      `,
    ).rejects.toMatchObject({
      constraint_name: "product_variants_mrp_gte_price",
    });
  });

  test("refuses a zero price and a zero stock movement", async () => {
    const { merchantId, productId, variantId } = await seedVariant();
    await expect(
      sql`
        insert into product_variants (id, product_id, merchant_id, sku, price_paise, weight_grams, length_mm, width_mm, height_mm)
        values (${createId()}, ${productId}, ${merchantId}, 'FREE', 0, 500, 100, 100, 50)
      `,
    ).rejects.toMatchObject({
      constraint_name: "product_variants_price_positive",
    });
    await expect(
      sql`
        insert into inventory_movements (id, variant_id, delta, reason, available_after)
        values (${createId()}, ${variantId}, 0, 'CORRECTION', 0)
      `,
    ).rejects.toMatchObject({
      constraint_name: "inventory_movements_delta_nonzero",
    });
  });

  test("a SKU is unique per merchant only", async () => {
    const first = await seedVariant();
    const second = await seedVariant();
    const insertSku = (merchantId: string, productId: string) => sql`
      insert into product_variants (id, product_id, merchant_id, sku, price_paise, weight_grams, length_mm, width_mm, height_mm)
      values (${createId()}, ${productId}, ${merchantId}, 'SHARED-SKU', 100, 1, 1, 1, 1)
    `;
    await insertSku(first.merchantId, first.productId);
    await insertSku(second.merchantId, second.productId);
    await expect(
      insertSku(first.merchantId, first.productId),
    ).rejects.toMatchObject({
      constraint_name: "product_variants_merchant_sku_unique",
    });
  });
});
