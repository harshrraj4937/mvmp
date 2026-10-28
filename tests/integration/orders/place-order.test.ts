import { asc, eq } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import {
  cartItemsTable,
  cartsTable,
  inventoryMovementsTable,
  inventoryReservationsTable,
  inventoryTable,
  ordersTable,
  orderStatusHistoryTable,
} from "~/db/schema";
import { addCartItem } from "~/modules/cart/application/cart";
import { unpublishProduct } from "~/modules/catalog/application/status";
import { updateVariant } from "~/modules/catalog/application/variants";
import { suspendMerchant } from "~/modules/merchants/application/review";
import { placeOrder } from "~/modules/orders/application/place-order";

import { testAdmin } from "../../support/merchant-fixtures";
import { publishedProduct, seedApprovedMerchant } from "../support/catalog";
import { connectTestDb } from "../support/db";
import { seedUser } from "../support/merchants";
import { seedAddress, seedCartOrder } from "../support/orders";

const { close, db } = connectTestDb();
afterAll(close);

async function cartLines(userId: string) {
  return db
    .select({
      quantity: cartItemsTable.quantity,
      variantId: cartItemsTable.variantId,
    })
    .from(cartItemsTable)
    .innerJoin(cartsTable, eq(cartsTable.id, cartItemsTable.cartId))
    .where(eq(cartsTable.userId, userId))
    .orderBy(asc(cartItemsTable.createdAt));
}

async function ordersOf(userId: string) {
  return db
    .select({ id: ordersTable.id })
    .from(ordersTable)
    .where(eq(ordersTable.userId, userId));
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

describe("placeOrder", () => {
  test("a two-shop cart becomes one order with a part per shop", async () => {
    const seeded = await seedCartOrder(db);
    const { created, order } = await placeOrder(
      db,
      seeded.userId,
      seeded.input,
    );

    expect(created).toBe(true);
    expect(order.number).toMatch(/^GIL-\d{4,}$/);
    expect(Number(order.number.slice(4))).toBeGreaterThanOrEqual(1001);
    expect(order).toMatchObject({
      deliveryPaise: 0,
      itemsTotalPaise: 84_900,
      paymentMethod: "COD",
      paymentStatus: "UNPAID",
      status: "CONFIRMED",
      totalPaise: 84_900,
    });
    expect(order.address).toEqual({
      city: "Panaji",
      fullName: "Asha Naik",
      landmark: "Near the chapel",
      line1: "12 Fontainhas Road",
      line2: null,
      phone: "+919876543210",
      postalCode: "403001",
      state: "goa",
    });
    expect(order.parts.map((part) => part.number)).toEqual([
      `${order.number}-A`,
      `${order.number}-B`,
    ]);
    const [partA, partB] = order.parts;
    expect(partA).toMatchObject({
      codAmountPaise: 34_900,
      shopSlug: seeded.shopA.slug,
      status: "NEW",
      totalPaise: 34_900,
    });
    expect(partB).toMatchObject({ codAmountPaise: 50_000, totalPaise: 50_000 });
    expect(partB?.items).toEqual([
      expect.objectContaining({
        declaredMrpPaise: null,
        lineTotalPaise: 50_000,
        productName: seeded.productB.name,
        quantity: 2,
        sku: expect.stringMatching(/^SKU-/),
        unitPricePaise: 25_000,
        variantLabel: null,
      }),
    ]);
    expect(order.parts.reduce((sum, part) => sum + part.totalPaise, 0)).toBe(
      order.totalPaise,
    );

    expect(await stock(seeded.productA.variantId)).toEqual({
      available: 4,
      reserved: 1,
    });
    expect(await stock(seeded.productB.variantId)).toEqual({
      available: 3,
      reserved: 2,
    });
    const reasons = await db
      .select({ reason: inventoryMovementsTable.reason })
      .from(inventoryMovementsTable)
      .where(eq(inventoryMovementsTable.variantId, seeded.productB.variantId));
    expect(reasons.map((row) => row.reason)).toContain("ORDER_RESERVED");
    const held = await db
      .select({ status: inventoryReservationsTable.status })
      .from(inventoryReservationsTable)
      .where(
        eq(inventoryReservationsTable.variantId, seeded.productB.variantId),
      );
    expect(held).toEqual([{ status: "HELD" }]);
    const history = await db.select().from(orderStatusHistoryTable);
    const mine = history.filter((row) =>
      order.parts.some((part) => part.id === row.merchantOrderId),
    );
    expect(mine).toHaveLength(2);
    expect(mine[0]).toMatchObject({
      actorRole: "SHOPPER",
      actorUserId: seeded.userId,
      fromStatus: null,
      toStatus: "NEW",
    });
    expect(await cartLines(seeded.userId)).toEqual([]);
  });

  test("the same checkout key returns the same order", async () => {
    const seeded = await seedCartOrder(db);
    const first = await placeOrder(db, seeded.userId, seeded.input);
    const again = await placeOrder(db, seeded.userId, seeded.input);
    expect(again.created).toBe(false);
    expect(again.order.number).toBe(first.order.number);
    expect(await stock(seeded.productA.variantId)).toEqual({
      available: 4,
      reserved: 1,
    });
    expect(await ordersOf(seeded.userId)).toHaveLength(1);
  });

  test("two presses at once with one key make one order", async () => {
    const seeded = await seedCartOrder(db);
    const results = await Promise.allSettled([
      placeOrder(db, seeded.userId, seeded.input),
      placeOrder(db, seeded.userId, seeded.input),
    ]);
    const numbers = results.map((result) =>
      result.status === "fulfilled" ? result.value.order.number : result.reason,
    );
    expect(numbers[0]).toBe(numbers[1]);
    expect(await ordersOf(seeded.userId)).toHaveLength(1);
    expect(await stock(seeded.productA.variantId)).toEqual({
      available: 4,
      reserved: 1,
    });
  });
});

describe("placeOrder refuses", () => {
  async function unchanged(seeded: Awaited<ReturnType<typeof seedCartOrder>>) {
    expect(await ordersOf(seeded.userId)).toHaveLength(0);
    expect(await stock(seeded.productA.variantId)).toEqual({
      available: 5,
      reserved: 0,
    });
    expect(await cartLines(seeded.userId)).toHaveLength(2);
  }

  test("an empty cart", async () => {
    const userId = await seedUser(db);
    const addressId = await seedAddress(db, userId);
    await expect(
      placeOrder(db, userId, {
        addressId,
        checkoutKey: "key_empty_cart_0001",
        expectedTotalPaise: 0,
        paymentMethod: "COD",
      }),
    ).rejects.toMatchObject({ code: "cart_empty", status: 409 });
  });

  test("a line whose price changed", async () => {
    const seeded = await seedCartOrder(db);
    await updateVariant(db, seeded.shopA, seeded.productA.variantId, {
      price: 399,
    });
    await expect(
      placeOrder(db, seeded.userId, seeded.input),
    ).rejects.toMatchObject({ code: "cart_needs_attention" });
    await unchanged(seeded);
  });

  test("a total that differs from what the shopper saw", async () => {
    const seeded = await seedCartOrder(db);
    await expect(
      placeOrder(db, seeded.userId, {
        ...seeded.input,
        expectedTotalPaise: 84_899,
      }),
    ).rejects.toMatchObject({
      code: "price_changed",
      details: { totalPaise: 84_900 },
    });
    await unchanged(seeded);
  });

  test("online payment, for now", async () => {
    const seeded = await seedCartOrder(db);
    await expect(
      placeOrder(db, seeded.userId, {
        ...seeded.input,
        paymentMethod: "PREPAID",
      }),
    ).rejects.toMatchObject({ code: "payment_method_unavailable" });
    await unchanged(seeded);
  });

  test("another shopper's address", async () => {
    const seeded = await seedCartOrder(db);
    const strangerAddress = await seedAddress(db, await seedUser(db));
    await expect(
      placeOrder(db, seeded.userId, {
        ...seeded.input,
        addressId: strangerAddress,
      }),
    ).rejects.toMatchObject({ code: "not_found", status: 404 });
    await unchanged(seeded);
  });

  test("a product unpublished after it was added", async () => {
    const seeded = await seedCartOrder(db);
    await unpublishProduct(db, seeded.shopB, seeded.productB.productId);
    await expect(
      placeOrder(db, seeded.userId, seeded.input),
    ).rejects.toMatchObject({ code: "cart_needs_attention" });
    await unchanged(seeded);
  });

  test("a shop suspended after the product was added", async () => {
    const seeded = await seedCartOrder(db);
    await suspendMerchant(
      db,
      testAdmin(await seedUser(db, "admin")),
      seeded.shopA.merchantId,
    );
    await expect(
      placeOrder(db, seeded.userId, seeded.input),
    ).rejects.toMatchObject({ code: "cart_needs_attention" });
    await unchanged(seeded);
  });
});

test("Scenario H: two shoppers, one last piece, one order", async () => {
  const shop = await seedApprovedMerchant(db);
  const last = await publishedProduct(db, shop, { price: "500", stock: 1 });
  const shoppers = await Promise.all(
    [0, 1].map(async (i) => {
      const userId = await seedUser(db);
      const addressId = await seedAddress(db, userId);
      await addCartItem(
        db,
        { guestToken: null, userId },
        { quantity: 1, variantId: last.variantId },
      );
      return {
        input: {
          addressId,
          checkoutKey: `key_scenario_h_${i}_${userId}`,
          expectedTotalPaise: 50_000,
          paymentMethod: "COD" as const,
        },
        userId,
      };
    }),
  );
  const results = await Promise.allSettled(
    shoppers.map((shopper) => placeOrder(db, shopper.userId, shopper.input)),
  );
  const won = results.filter((result) => result.status === "fulfilled");
  const lost = results.filter((result) => result.status === "rejected");
  expect(won).toHaveLength(1);
  expect(lost).toHaveLength(1);
  expect((lost[0] as PromiseRejectedResult).reason).toMatchObject({
    code: "insufficient_stock",
  });
  expect(await stock(last.variantId)).toEqual({ available: 0, reserved: 1 });
});
