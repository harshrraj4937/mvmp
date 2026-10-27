import { eq } from "drizzle-orm";
import { afterAll, expect, test } from "vitest";

import { inventoryMovementsTable, inventoryTable } from "~/db/schema";
import {
  adjustStock,
  listStockMovements,
} from "~/modules/catalog/application/inventory";
import { createProduct } from "~/modules/catalog/application/products";

import { productInput, seedApprovedMerchant } from "../support/catalog";
import { connectTestDb } from "../support/db";

const { close, db } = connectTestDb();
afterAll(close);

async function variantWithStock(stock: number) {
  const shop = await seedApprovedMerchant(db);
  const product = await createProduct(
    db,
    shop,
    productInput({ initialStock: stock }),
  );
  return { shop, variantId: product.variants[0]?.id ?? "" };
}

test("an adjustment updates stock and records who and why", async () => {
  const { shop, variantId } = await variantWithStock(10);
  const variant = await adjustStock(db, shop, variantId, {
    delta: 5,
    note: "Diwali batch",
    reason: "RESTOCK",
  });
  expect(variant.available).toBe(15);
  const [latest] = await listStockMovements(db, shop, variantId);
  expect(latest).toMatchObject({
    actorName: "Merchant Test",
    availableAfter: 15,
    delta: 5,
    note: "Diwali batch",
    reason: "RESTOCK",
  });
});

test("stock cannot go below zero", async () => {
  const { shop, variantId } = await variantWithStock(3);
  await expect(
    adjustStock(db, shop, variantId, { delta: -5, reason: "DAMAGED" }),
  ).rejects.toMatchObject({
    code: "insufficient_stock",
    message: "Not enough stock for that change.",
  });
  const [row] = await db
    .select()
    .from(inventoryTable)
    .where(eq(inventoryTable.variantId, variantId));
  expect(row?.available).toBe(3);
  expect(await listStockMovements(db, shop, variantId)).toHaveLength(1);
});

test("twenty concurrent −1 adjustments on stock 10 leave 0 and exactly 10 movements", async () => {
  const { shop, variantId } = await variantWithStock(10);
  const results = await Promise.allSettled(
    Array.from({ length: 20 }, () =>
      adjustStock(db, shop, variantId, { delta: -1, reason: "CORRECTION" }),
    ),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(10);
  const rejected = results.filter((r) => r.status === "rejected");
  expect(rejected).toHaveLength(10);
  for (const r of rejected) {
    expect((r as PromiseRejectedResult).reason).toMatchObject({
      code: "insufficient_stock",
    });
  }
  const [row] = await db
    .select()
    .from(inventoryTable)
    .where(eq(inventoryTable.variantId, variantId));
  expect(row?.available).toBe(0);
  const movements = await db
    .select()
    .from(inventoryMovementsTable)
    .where(eq(inventoryMovementsTable.variantId, variantId));
  expect(movements.filter((m) => m.reason === "CORRECTION")).toHaveLength(10);
  const afters = movements
    .filter((m) => m.reason === "CORRECTION")
    .map((m) => m.availableAfter)
    .sort((a, b) => a - b);
  expect(afters).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});
