import { createId } from "@paralleldrive/cuid2";
import { asc, like } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, describe, expect, inject, test } from "vitest";

import { runMigrations } from "~/db/migrate";
import { categoriesTable } from "~/db/schema";

import { connectTestDb } from "../support/db";
import { seedMerchant, seedUser } from "../support/merchants";

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

describe("Phase 4 (migration 0005)", () => {
  const { close, db } = connectTestDb();
  const sql = postgres(inject("databaseUrl"), { max: 1 });

  afterAll(async () => {
    await close();
    await sql.end();
  });

  test("adds story images and cart tables", async () => {
    const tables = await listPublicTables(inject("databaseUrl"));
    expect(tables).toEqual(
      expect.arrayContaining(["merchant_story_images", "carts", "cart_items"]),
    );
  });

  test("craft categories say materials, food categories ingredients", async () => {
    const rows = await sql<{ composition_label: string; slug: string }[]>`
      select slug, composition_label from categories where id like 'cat\\_%'
    `;
    const label = (slug: string) =>
      rows.find((row) => row.slug === slug)?.composition_label;
    expect(label("art-and-handicrafts")).toBe("MATERIALS");
    expect(label("home-and-festive-decor")).toBe("MATERIALS");
    expect(label("handmade-gifts")).toBe("MATERIALS");
    expect(label("snacks-and-sweets")).toBe("INGREDIENTS");
    expect(label("other-regional-products")).toBe("INGREDIENTS");
  });

  test("a cart has exactly one owner", async () => {
    await expect(
      sql`insert into carts (id) values (${createId()})`,
    ).rejects.toMatchObject({ constraint_name: "carts_one_owner" });
    await expect(
      sql`
        insert into carts (id, user_id, guest_token_hash)
        values (${createId()}, ${await seedUser(db)}, ${createId()})
      `,
    ).rejects.toMatchObject({ constraint_name: "carts_one_owner" });
  });

  test("cart quantities stay between 1 and 10, one line per variant", async () => {
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
    const cartId = createId();
    await sql`insert into carts (id, guest_token_hash) values (${cartId}, ${createId()})`;
    const line = (quantity: number) => sql`
      insert into cart_items (id, cart_id, variant_id, quantity, unit_price_paise_seen)
      values (${createId()}, ${cartId}, ${variantId}, ${quantity}, 39900)
    `;
    await expect(line(11)).rejects.toMatchObject({
      constraint_name: "cart_items_quantity_range",
    });
    await expect(line(0)).rejects.toMatchObject({
      constraint_name: "cart_items_quantity_range",
    });
    await line(10);
    await expect(line(1)).rejects.toMatchObject({
      constraint_name: "cart_items_cart_variant_unique",
    });
  });
});

describe("Phase 5 (migration 0006)", () => {
  const { close, db } = connectTestDb();
  const sql = postgres(inject("databaseUrl"), { max: 1 });

  afterAll(async () => {
    await close();
    await sql.end();
  });

  const address = (userId: string, isDefault: boolean) => sql`
    insert into customer_addresses (id, user_id, full_name, phone, line1, city, state, postal_code, is_default)
    values (${createId()}, ${userId}, 'Asha Naik', '+919876543210', '12 Fontainhas Road', 'Panaji', 'goa', '403001', ${isDefault})
  `;

  const order = (
    userId: string,
    checkoutKey: string,
    totalPaise = 39900,
  ) => sql`
    insert into orders (id, number, user_id, status, payment_method, payment_status, checkout_key, items_total_paise, total_paise)
    values (${createId()}, ${`GIL-T${createId()}`}, ${userId}, 'CONFIRMED', 'COD', 'UNPAID', ${checkoutKey}, ${totalPaise}, ${totalPaise})
    returning id
  `;

  test("adds the order tables", async () => {
    const tables = await listPublicTables(inject("databaseUrl"));
    expect(tables).toEqual(
      expect.arrayContaining([
        "customer_addresses",
        "orders",
        "merchant_orders",
        "order_items",
        "order_address_snapshots",
        "order_status_history",
        "inventory_reservations",
      ]),
    );
  });

  test("order numbers start at 1001", async () => {
    const [row] = await sql<
      { n: string }[]
    >`select nextval('order_number_seq') as n`;
    expect(Number(row?.n)).toBeGreaterThanOrEqual(1001);
  });

  test("a shopper has one default address", async () => {
    const userId = await seedUser(db);
    await address(userId, true);
    await address(userId, false);
    await expect(address(userId, true)).rejects.toMatchObject({
      constraint_name: "customer_addresses_one_default",
    });
  });

  test("one order per checkout key per shopper, totals never negative", async () => {
    const userId = await seedUser(db);
    const key = createId();
    await order(userId, key);
    await expect(order(userId, key)).rejects.toMatchObject({
      constraint_name: "orders_user_checkout_key_unique",
    });
    await order(await seedUser(db), key);
    await expect(order(userId, createId(), -1)).rejects.toMatchObject({
      code: "23514",
    });
  });

  test("order item quantity is positive", async () => {
    const userId = await seedUser(db);
    const merchant = await seedMerchant(db);
    const [created] = await order(userId, createId());
    const partId = createId();
    await sql`
      insert into merchant_orders (id, number, order_id, merchant_id, items_total_paise, total_paise)
      values (${partId}, ${`GIL-T${partId}-A`}, ${created?.id ?? ""}, ${merchant.merchantId}, 39900, 39900)
    `;
    await expect(
      sql`
        insert into order_items (id, merchant_order_id, product_name, product_slug, sku, unit_price_paise, quantity, line_total_paise)
        values (${createId()}, ${partId}, 'Diya set', 'diya-set', 'SKU-1', 39900, 0, 0)
      `,
    ).rejects.toMatchObject({ code: "23514" });
  });

  test("stock movements can record order reasons", async () => {
    const rows = await sql<{ value: string }[]>`
      select unnest(enum_range(null::inventory_movement_reason))::text as value
    `;
    expect(rows.map((row) => row.value)).toEqual(
      expect.arrayContaining(["ORDER_RESERVED", "ORDER_RELEASED"]),
    );
  });
});
