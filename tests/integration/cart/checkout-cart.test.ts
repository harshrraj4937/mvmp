import { afterAll, expect, test } from "vitest";

import { addCartItem } from "~/modules/cart/application/cart";
import {
  lockUserCart,
  removeCartLines,
} from "~/modules/cart/application/checkout-cart";

import { publishedProduct, seedApprovedMerchant } from "../support/catalog";
import { connectTestDb } from "../support/db";
import { seedUser } from "../support/merchants";

const { close, db } = connectTestDb();
afterAll(close);

test("lockUserCart returns the lines in the order they were added", async () => {
  const userId = await seedUser(db);
  const shop = await seedApprovedMerchant(db);
  const first = await publishedProduct(db, shop, { price: "250" });
  const second = await publishedProduct(db, shop);
  const owner = { guestToken: null, userId };
  await addCartItem(db, owner, { quantity: 2, variantId: first.variantId });
  await addCartItem(db, owner, { quantity: 1, variantId: second.variantId });

  const locked = await db.transaction((tx) => lockUserCart(tx, userId));
  expect(locked?.lines.map((line) => line.variantId)).toEqual([
    first.variantId,
    second.variantId,
  ]);
  expect(locked?.lines[0]).toMatchObject({
    quantity: 2,
    unitPricePaiseSeen: 25000,
  });
});

test("lockUserCart is null for a shopper without a cart", async () => {
  const userId = await seedUser(db);
  expect(await db.transaction((tx) => lockUserCart(tx, userId))).toBeNull();
});

test("removeCartLines removes only the given variants", async () => {
  const userId = await seedUser(db);
  const shop = await seedApprovedMerchant(db);
  const keep = await publishedProduct(db, shop);
  const drop = await publishedProduct(db, shop);
  const owner = { guestToken: null, userId };
  await addCartItem(db, owner, { quantity: 1, variantId: keep.variantId });
  await addCartItem(db, owner, { quantity: 1, variantId: drop.variantId });

  await db.transaction(async (tx) => {
    const locked = await lockUserCart(tx, userId);
    await removeCartLines(tx, locked?.cartId ?? "", [drop.variantId]);
  });
  const after = await db.transaction((tx) => lockUserCart(tx, userId));
  expect(after?.lines.map((line) => line.variantId)).toEqual([keep.variantId]);
});
