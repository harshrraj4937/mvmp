import { eq } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import {
  inventoryReservationsTable,
  inventoryTable,
  orderStatusHistoryTable,
} from "~/db/schema";
import {
  advanceMerchantOrder,
  cancelMerchantOrder,
  countMerchantOrders,
  getMerchantOrder,
  listMerchantOrders,
} from "~/modules/orders/application/merchant-orders";
import { placeOrder } from "~/modules/orders/application/place-order";
import {
  cancelShopperOrder,
  getShopperOrder,
  listShopperOrders,
} from "~/modules/orders/application/shopper-orders";
import { systemAdvance } from "~/modules/orders/application/transition";

import { connectTestDb } from "../support/db";
import { seedUser } from "../support/merchants";
import { seedCartOrder } from "../support/orders";

const { close, db } = connectTestDb();
afterAll(close);

async function placed() {
  const seeded = await seedCartOrder(db);
  const { order } = await placeOrder(db, seeded.userId, seeded.input);
  const [partA, partB] = order.parts;
  if (!partA || !partB) {
    throw new Error("Expected two parts.");
  }
  return { ...seeded, order, partA, partB };
}

async function reservation(variantId: string) {
  const [row] = await db
    .select({ status: inventoryReservationsTable.status })
    .from(inventoryReservationsTable)
    .where(eq(inventoryReservationsTable.variantId, variantId));
  return row?.status;
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

const invalid = { code: "invalid_transition", status: 409 };

describe("maker steps", () => {
  test("a maker walks a part to packed", async () => {
    const o = await placed();
    for (const to of ["ACKNOWLEDGED", "PACKING", "READY_FOR_PICKUP"] as const) {
      await advanceMerchantOrder(db, o.shopA, o.partA.id, to);
    }
    const part = await getMerchantOrder(db, o.shopA, o.partA.id);
    expect(part.status).toBe("READY_FOR_PICKUP");
    expect(part.history.map((row) => [row.from, row.to])).toEqual([
      [null, "NEW"],
      ["NEW", "ACKNOWLEDGED"],
      ["ACKNOWLEDGED", "PACKING"],
      ["PACKING", "READY_FOR_PICKUP"],
    ]);
    expect(part.history[1]).toMatchObject({ actorRole: "MERCHANT" });
    expect((await getShopperOrder(db, o.userId, o.order.number)).status).toBe(
      "PROCESSING",
    );
  });

  test("a maker cannot skip a step or go past packed", async () => {
    const o = await placed();
    await expect(
      advanceMerchantOrder(db, o.shopA, o.partA.id, "PACKING"),
    ).rejects.toMatchObject(invalid);
    await advanceMerchantOrder(db, o.shopA, o.partA.id, "ACKNOWLEDGED");
    await expect(
      advanceMerchantOrder(db, o.shopA, o.partA.id, "ACKNOWLEDGED"),
    ).rejects.toMatchObject(invalid);
  });

  test("the merchant view has delivery details, SKUs and the COD amount", async () => {
    const o = await placed();
    const part = await getMerchantOrder(db, o.shopB, o.partB.id);
    expect(part).toMatchObject({
      address: { fullName: "Asha Naik", phone: "+919876543210" },
      codAmountPaise: 50_000,
      number: o.partB.number,
      paymentMethod: "COD",
      status: "NEW",
      totalPaise: 50_000,
    });
    expect(part.items).toEqual([
      expect.objectContaining({
        productName: o.productB.name,
        quantity: 2,
        sku: expect.stringMatching(/^SKU-/),
      }),
    ]);
  });
});

describe("cancelling", () => {
  test("out of stock writes the held pieces off", async () => {
    const o = await placed();
    await cancelMerchantOrder(db, o.shopB, o.partB.id, {
      reason: "OUT_OF_STOCK",
    });
    expect(await stock(o.productB.variantId)).toEqual({
      available: 3,
      reserved: 0,
    });
    expect(await reservation(o.productB.variantId)).toBe("WRITTEN_OFF");
    const shopperView = await getShopperOrder(db, o.userId, o.order.number);
    expect(shopperView.parts[1]).toMatchObject({
      canceledBy: "MERCHANT",
      cancelReason: "OUT_OF_STOCK",
      status: "CANCELED",
    });
    expect(shopperView.parts[0]?.status).toBe("NEW");
    expect(shopperView.status).toBe("CONFIRMED");
  });

  test("can't fulfil puts the pieces back on sale", async () => {
    const o = await placed();
    await advanceMerchantOrder(db, o.shopB, o.partB.id, "ACKNOWLEDGED");
    await cancelMerchantOrder(db, o.shopB, o.partB.id, {
      note: "Kiln broke",
      reason: "CANNOT_FULFIL",
    });
    expect(await stock(o.productB.variantId)).toEqual({
      available: 5,
      reserved: 0,
    });
    expect(await reservation(o.productB.variantId)).toBe("RELEASED");
    const part = await getMerchantOrder(db, o.shopB, o.partB.id);
    expect(part).toMatchObject({
      cancelNote: "Kiln broke",
      status: "CANCELED",
    });
    await expect(
      cancelMerchantOrder(db, o.shopB, o.partB.id, {
        note: "x",
        reason: "OTHER",
      }),
    ).rejects.toMatchObject(invalid);
  });

  test("a shopper cancels one parcel, then the rest", async () => {
    const o = await placed();
    let view = await cancelShopperOrder(db, o.userId, o.order.number, {
      merchantOrder: o.partB.number,
      reason: "Ordered by mistake",
    });
    expect(view.parts.map((part) => part.status)).toEqual(["NEW", "CANCELED"]);
    expect(view.parts[1]).toMatchObject({
      canceledBy: "SHOPPER",
      cancelNote: "Ordered by mistake",
      cancelReason: null,
    });
    expect(view.status).toBe("CONFIRMED");
    expect(await stock(o.productB.variantId)).toEqual({
      available: 5,
      reserved: 0,
    });

    view = await cancelShopperOrder(db, o.userId, o.order.number, {});
    expect(view.status).toBe("CANCELED");
    expect(await stock(o.productA.variantId)).toEqual({
      available: 5,
      reserved: 0,
    });
    await expect(
      cancelShopperOrder(db, o.userId, o.order.number, {}),
    ).rejects.toMatchObject(invalid);
  });

  test("nothing can be cancelled once delivered", async () => {
    const o = await placed();
    for (const to of ["ACKNOWLEDGED", "PACKING", "READY_FOR_PICKUP"] as const) {
      await advanceMerchantOrder(db, o.shopA, o.partA.id, to);
    }
    await systemAdvance(db, o.partA.id, "HANDED_TO_COURIER");
    expect(await stock(o.productA.variantId)).toEqual({
      available: 4,
      reserved: 0,
    });
    expect(await reservation(o.productA.variantId)).toBe("CONSUMED");
    await systemAdvance(db, o.partA.id, "FULFILLED");
    expect((await getShopperOrder(db, o.userId, o.order.number)).status).toBe(
      "PARTIALLY_FULFILLED",
    );
    await expect(
      cancelShopperOrder(db, o.userId, o.order.number, {
        merchantOrder: o.partA.number,
      }),
    ).rejects.toMatchObject(invalid);
    await cancelShopperOrder(db, o.userId, o.order.number, {});
    const view = await getShopperOrder(db, o.userId, o.order.number);
    expect(view.parts.map((part) => part.status)).toEqual([
      "FULFILLED",
      "CANCELED",
    ]);
    expect(view.status).toBe("COMPLETED");
  });

  test("cancelling after pickup returns nothing to stock", async () => {
    const o = await placed();
    for (const to of ["ACKNOWLEDGED", "PACKING", "READY_FOR_PICKUP"] as const) {
      await advanceMerchantOrder(db, o.shopA, o.partA.id, to);
    }
    await systemAdvance(db, o.partA.id, "HANDED_TO_COURIER");
    await cancelShopperOrder(db, o.userId, o.order.number, {
      merchantOrder: o.partA.number,
    });
    expect(await stock(o.productA.variantId)).toEqual({
      available: 4,
      reserved: 0,
    });
    expect(await reservation(o.productA.variantId)).toBe("CONSUMED");
  });

  test("shopper and maker cancel one parcel at once: one wins, stock moves once", async () => {
    const o = await placed();
    const results = await Promise.allSettled([
      cancelShopperOrder(db, o.userId, o.order.number, {
        merchantOrder: o.partB.number,
      }),
      cancelMerchantOrder(db, o.shopB, o.partB.id, { reason: "OUT_OF_STOCK" }),
    ]);
    const lost = results.filter((result) => result.status === "rejected");
    expect(lost).toHaveLength(1);
    expect((lost[0] as PromiseRejectedResult).reason).toMatchObject(invalid);
    const part = await getMerchantOrder(db, o.shopB, o.partB.id);
    const expected =
      part.canceledBy === "SHOPPER"
        ? { available: 5, reserved: 0 }
        : { available: 3, reserved: 0 };
    expect(await stock(o.productB.variantId)).toEqual(expected);
    const cancels = await db
      .select({ to: orderStatusHistoryTable.toStatus })
      .from(orderStatusHistoryTable)
      .where(eq(orderStatusHistoryTable.merchantOrderId, o.partB.id));
    expect(cancels.filter((row) => row.to === "CANCELED")).toHaveLength(1);
  });
});

describe("who sees what", () => {
  test("a maker sees only their own parts", async () => {
    const o = await placed();
    const listed = await listMerchantOrders(db, o.shopA, { page: 1 });
    expect(listed.total).toBe(1);
    expect(listed.items[0]).toMatchObject({
      itemCount: 1,
      itemsSummary: `${o.productA.name} ×1`,
      number: o.partA.number,
      paymentMethod: "COD",
      status: "NEW",
      totalPaise: 34_900,
    });
    await expect(
      getMerchantOrder(db, o.shopA, o.partB.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      advanceMerchantOrder(db, o.shopA, o.partB.id, "ACKNOWLEDGED"),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      cancelMerchantOrder(db, o.shopA, o.partB.id, { reason: "DAMAGED" }),
    ).rejects.toMatchObject({ status: 404 });
  });

  test("the status filter and counts", async () => {
    const o = await placed();
    expect(await countMerchantOrders(db, o.shopA.merchantId)).toEqual({
      newOrders: 1,
      toPack: 0,
    });
    await advanceMerchantOrder(db, o.shopA, o.partA.id, "ACKNOWLEDGED");
    expect(await countMerchantOrders(db, o.shopA.merchantId)).toEqual({
      newOrders: 0,
      toPack: 1,
    });
    expect(
      (await listMerchantOrders(db, o.shopA, { page: 1, status: "NEW" })).total,
    ).toBe(0);
    expect(
      (
        await listMerchantOrders(db, o.shopA, {
          page: 1,
          status: "ACKNOWLEDGED",
        })
      ).total,
    ).toBe(1);
  });

  test("a shopper sees only their own orders", async () => {
    const o = await placed();
    const mine = await listShopperOrders(db, o.userId);
    expect(mine).toEqual([
      expect.objectContaining({
        number: o.order.number,
        partStatuses: ["NEW", "NEW"],
        status: "CONFIRMED",
        totalPaise: 84_900,
      }),
    ]);
    const stranger = await seedUser(db);
    expect(await listShopperOrders(db, stranger)).toEqual([]);
    await expect(
      getShopperOrder(db, stranger, o.order.number),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      cancelShopperOrder(db, stranger, o.order.number, {}),
    ).rejects.toMatchObject({ status: 404 });
    expect((await getShopperOrder(db, o.userId, o.order.number)).status).toBe(
      "CONFIRMED",
    );
  });
});
