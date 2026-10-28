import { and, desc, eq } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import { inventoryMovementsTable, inventoryTable } from "~/db/schema";
import {
  consumeStock,
  releaseStock,
  reserveStock,
} from "~/modules/catalog/application/reservations";

import { publishedProduct, seedApprovedMerchant } from "../support/catalog";
import { connectTestDb } from "../support/db";

const { close, db } = connectTestDb();
afterAll(close);

async function movements(variantId: string) {
  return db
    .select({
      availableAfter: inventoryMovementsTable.availableAfter,
      delta: inventoryMovementsTable.delta,
      reason: inventoryMovementsTable.reason,
    })
    .from(inventoryMovementsTable)
    .where(eq(inventoryMovementsTable.variantId, variantId))
    .orderBy(desc(inventoryMovementsTable.createdAt));
}

async function product(stockCount = 5) {
  const shop = await seedApprovedMerchant(db);
  return publishedProduct(db, shop, { stock: stockCount });
}

async function stock(variantId: string) {
  const [row] = await db
    .select({
      available: inventoryTable.available,
      reserved: inventoryTable.reserved,
    })
    .from(inventoryTable)
    .where(eq(inventoryTable.variantId, variantId));
  return row;
}

describe("reserveStock", () => {
  test("holds stock and records the movement", async () => {
    const { variantId } = await product();
    await db.transaction((tx) =>
      reserveStock(tx, [{ quantity: 2, variantId }], null),
    );
    expect(await stock(variantId)).toEqual({ available: 3, reserved: 2 });
    const [latest] = await movements(variantId);
    expect(latest).toEqual({
      availableAfter: 3,
      delta: -2,
      reason: "ORDER_RESERVED",
    });
  });

  test("refuses more than is available and changes nothing", async () => {
    const { name, variantId } = await product();
    const failure = db.transaction((tx) =>
      reserveStock(tx, [{ quantity: 6, variantId }], null),
    );
    await expect(failure).rejects.toMatchObject({
      code: "insufficient_stock",
      details: { available: 5, variantId },
      message: `Only 5 left of ${name}.`,
    });
    expect(await stock(variantId)).toEqual({ available: 5, reserved: 0 });
    expect(await movements(variantId)).toHaveLength(1);
  });

  test("a sold-out line rolls back the lines before it", async () => {
    const first = await product();
    const second = await product(0);
    const failure = db.transaction((tx) =>
      reserveStock(
        tx,
        [
          { quantity: 1, variantId: first.variantId },
          { quantity: 1, variantId: second.variantId },
        ],
        null,
      ),
    );
    await expect(failure).rejects.toMatchObject({
      code: "insufficient_stock",
      message: `${second.name} is sold out.`,
    });
    expect(await stock(first.variantId)).toEqual({ available: 5, reserved: 0 });
  });
});

describe("releaseStock and consumeStock", () => {
  async function held() {
    const { variantId } = await product();
    await db.transaction((tx) =>
      reserveStock(tx, [{ quantity: 2, variantId }], null),
    );
    return variantId;
  }

  test("release puts the pieces back on sale", async () => {
    const variantId = await held();
    await db.transaction((tx) =>
      releaseStock(tx, [{ quantity: 2, variantId }], "release", null),
    );
    expect(await stock(variantId)).toEqual({ available: 5, reserved: 0 });
    const [latest] = await movements(variantId);
    expect(latest).toEqual({
      availableAfter: 5,
      delta: 2,
      reason: "ORDER_RELEASED",
    });
  });

  test("write-off drops the hold without selling the pieces again", async () => {
    const variantId = await held();
    const before = await movements(variantId);
    await db.transaction((tx) =>
      releaseStock(tx, [{ quantity: 2, variantId }], "write_off", null),
    );
    expect(await stock(variantId)).toEqual({ available: 3, reserved: 0 });
    expect(await movements(variantId)).toHaveLength(before.length);
  });

  test("consume drops the hold when the parcel leaves", async () => {
    const variantId = await held();
    await db.transaction((tx) =>
      consumeStock(tx, [{ quantity: 2, variantId }]),
    );
    expect(await stock(variantId)).toEqual({ available: 3, reserved: 0 });
  });

  test("releasing more than is held is a bug and throws", async () => {
    const variantId = await held();
    await expect(
      db.transaction((tx) =>
        releaseStock(tx, [{ quantity: 3, variantId }], "release", null),
      ),
    ).rejects.toThrow();
    expect(
      await db
        .select({ reserved: inventoryTable.reserved })
        .from(inventoryTable)
        .where(and(eq(inventoryTable.variantId, variantId))),
    ).toEqual([{ reserved: 2 }]);
  });
});
