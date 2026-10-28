import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import { cartsTable } from "~/db/schema";
import {
  addCartItem,
  getCart,
  removeCartItem,
  updateCartItem,
} from "~/modules/cart/application/cart";
import { hashGuestToken } from "~/modules/cart/presentation/guest-cookie";
import { holdProduct } from "~/modules/catalog/application/admin";
import { updateCategory } from "~/modules/catalog/application/categories";
import { adjustStock } from "~/modules/catalog/application/inventory";
import { createProduct } from "~/modules/catalog/application/products";
import {
  publishProduct,
  unpublishProduct,
} from "~/modules/catalog/application/status";
import {
  addVariant,
  updateVariant,
} from "~/modules/catalog/application/variants";
import { variantCreateSchema } from "~/modules/catalog/presentation/schemas";
import { suspendMerchant } from "~/modules/merchants/application/review";

import { testAdmin } from "../../support/merchant-fixtures";
import {
  addImageRow,
  productInput,
  seedApprovedMerchant,
  seedCategory,
} from "../support/catalog";
import { connectTestDb } from "../support/db";
import { seedUser } from "../support/merchants";

const { close, db } = connectTestDb();
afterAll(close);

type Shop = Awaited<ReturnType<typeof seedApprovedMerchant>>;

const guest = (guestToken: null | string = null) => ({
  guestToken,
  userId: null,
});
const signedIn = (userId: string, guestToken: null | string = null) => ({
  guestToken,
  userId,
});

/** A published product with one variant at `price` rupees and `stock` units. */
async function buyable(
  shop: Shop,
  { price = "100", stock = 5 }: { price?: string; stock?: number } = {},
) {
  const created = await createProduct(
    db,
    shop,
    productInput({ initialStock: stock }, { price }),
  );
  await addImageRow(db, created.id);
  await publishProduct(db, shop, created.id);
  return { productId: created.id, variantId: created.variants[0]?.id ?? "" };
}

async function cartCount(hash: string): Promise<number> {
  const rows = await db
    .select({ id: cartsTable.id })
    .from(cartsTable)
    .where(eq(cartsTable.guestTokenHash, hash));
  return rows.length;
}

/** A product with two sizes (Small, Large), both in stock, published. */
async function twoSizes(shop: Shop) {
  const created = await createProduct(
    db,
    shop,
    productInput({ initialStock: 5 }, { price: "100" }),
  );
  await addImageRow(db, created.id);
  await updateVariant(db, shop, created.variants[0]?.id ?? "", {
    label: "Small",
  });
  const detail = await addVariant(
    db,
    shop,
    created.id,
    variantCreateSchema.parse({
      heightMm: 50,
      initialStock: 5,
      label: "Large",
      lengthMm: 100,
      price: "150",
      sku: `LARGE-${createId().slice(0, 10)}`,
      weightGrams: 500,
      widthMm: 100,
    }),
  );
  await publishProduct(db, shop, created.id);
  return {
    largeId: detail.variants.find((v) => v.label === "Large")?.id ?? "",
    smallId: created.variants[0]?.id ?? "",
  };
}

describe("guest cart", () => {
  test("reads with no cookie return an empty view and create nothing", async () => {
    const result = await getCart(db, guest());
    expect(result.view).toMatchObject({
      canCheckout: false,
      count: 0,
      groups: [],
      mergeDropped: 0,
      totalPaise: 0,
    });
    expect(result.cookie).toBeNull();
  });

  test("the first add creates the cart and sets the cookie", async () => {
    const shop = await seedApprovedMerchant(db);
    const { variantId } = await buyable(shop);
    const result = await addCartItem(db, guest(), { quantity: 1, variantId });
    expect(result.cookie).not.toBeNull();
    if (!result.cookie || !("set" in result.cookie)) {
      throw new Error("expected a cookie to be set");
    }
    expect(result.cookie.set.length).toBeGreaterThanOrEqual(43);
    expect(result.view.count).toBe(1);

    const again = await getCart(db, guest(result.cookie.set));
    expect(again.view.groups[0]?.lines[0]).toMatchObject({
      quantity: 1,
      variantId,
    });
    expect(again.cookie).toBeNull();
  });

  test("another token reads an empty cart", async () => {
    const shop = await seedApprovedMerchant(db);
    const { variantId } = await buyable(shop);
    const first = await addCartItem(db, guest(), { quantity: 1, variantId });
    const other = await getCart(db, guest(newToken()));
    expect(other.view.groups).toEqual([]);
    expect(other.cookie).toEqual({ clear: true });
    expect(first.cookie).not.toBeNull();
  });

  test("adding the same variant twice sums the quantity", async () => {
    const shop = await seedApprovedMerchant(db);
    const { variantId } = await buyable(shop);
    const first = await addCartItem(db, guest(), { quantity: 1, variantId });
    const token = tokenOf(first.cookie);
    const second = await addCartItem(db, guest(token), {
      quantity: 2,
      variantId,
    });
    expect(second.view.count).toBe(3);
  });

  test("over stock is insufficient_stock with the available count", async () => {
    const shop = await seedApprovedMerchant(db);
    const { variantId } = await buyable(shop, { stock: 5 });
    await expect(
      addCartItem(db, guest(), { quantity: 6, variantId }),
    ).rejects.toMatchObject({
      code: "insufficient_stock",
      details: { available: 5 },
    });
  });

  test("a draft product is not_purchasable", async () => {
    const shop = await seedApprovedMerchant(db);
    const draft = await createProduct(db, shop, productInput());
    await addImageRow(db, draft.id);
    await expect(
      addCartItem(db, guest(), {
        quantity: 1,
        variantId: draft.variants[0]?.id ?? "",
      }),
    ).rejects.toMatchObject({ code: "not_purchasable" });
  });

  test("an unknown variant is a 404", async () => {
    await expect(
      addCartItem(db, guest(), { quantity: 1, variantId: createId() }),
    ).rejects.toMatchObject({ status: 404 });
  });

  test("a 31st different line is cart_full", async () => {
    const shop = await seedApprovedMerchant(db);
    let result = await addCartItem(db, guest(), {
      quantity: 1,
      variantId: (await buyable(shop)).variantId,
    });
    const token = tokenOf(result.cookie);
    for (let index = 1; index < 30; index += 1) {
      result = await addCartItem(db, guest(token), {
        quantity: 1,
        variantId: (await buyable(shop)).variantId,
      });
    }
    expect(result.view.groups.flatMap((g) => g.lines)).toHaveLength(30);
    await expect(
      addCartItem(db, guest(token), {
        quantity: 1,
        variantId: (await buyable(shop)).variantId,
      }),
    ).rejects.toMatchObject({ code: "cart_full" });
  });

  test("update and remove of a variant not in the cart are 404", async () => {
    const shop = await seedApprovedMerchant(db);
    const { variantId } = await buyable(shop);
    const added = await addCartItem(db, guest(), { quantity: 1, variantId });
    const token = tokenOf(added.cookie);
    await expect(
      updateCartItem(db, guest(token), createId(), { quantity: 1 }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      removeCartItem(db, guest(token), createId()),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("line status after adding", () => {
  test("a price change shows price_changed, and acknowledging returns it to ok", async () => {
    const shop = await seedApprovedMerchant(db);
    const { variantId } = await buyable(shop, { price: "100" });
    const added = await addCartItem(db, guest(), { quantity: 1, variantId });
    const token = tokenOf(added.cookie);
    await updateVariant(db, shop, variantId, { price: 120 });

    const changed = await getCart(db, guest(token));
    expect(changed.view.groups[0]?.lines[0]?.status).toBe("price_changed");
    expect(changed.view.canCheckout).toBe(false);

    const acknowledged = await updateCartItem(db, guest(token), variantId, {
      acknowledgePrice: true,
    });
    expect(acknowledged.view.groups[0]?.lines[0]?.status).toBe("ok");
    expect(acknowledged.view.canCheckout).toBe(true);
  });

  test("sold out and short come from stock", async () => {
    const shop = await seedApprovedMerchant(db);
    const { variantId } = await buyable(shop, { stock: 5 });
    const added = await addCartItem(db, guest(), {
      quantity: 4,
      variantId,
    });
    const token = tokenOf(added.cookie);

    await adjustStock(db, shop, variantId, { delta: -2, reason: "DAMAGED" });
    expect(
      (await getCart(db, guest(token))).view.groups[0]?.lines[0],
    ).toMatchObject({ productLinkable: true, status: "short" });

    // The only size is sold out, so the product page is gone: no link to it.
    await adjustStock(db, shop, variantId, { delta: -3, reason: "DAMAGED" });
    expect(
      (await getCart(db, guest(token))).view.groups[0]?.lines[0],
    ).toMatchObject({ productLinkable: false, status: "sold_out" });
  });

  test("a line whose product is no longer on sale is unavailable", async () => {
    const shop = await seedApprovedMerchant(db);
    const moderator = testAdmin(await seedUser(db, "admin"));
    const { variantId } = await buyable(shop);
    const added = await addCartItem(db, guest(), { quantity: 1, variantId });
    const token = tokenOf(added.cookie);
    await unpublishProduct(db, shop, await productOf(variantId));
    expect(
      (await getCart(db, guest(token))).view.groups[0]?.lines[0]?.status,
    ).toBe("unavailable");

    const held = await buyable(shop);
    const heldAdd = await addCartItem(db, guest(token), {
      quantity: 1,
      variantId: held.variantId,
    });
    expect(heldAdd.view.count).toBe(2);
    await holdProduct(db, moderator, held.productId, { reason: "Review." });
    expect(
      (await getCart(db, guest(token))).view.groups[0]?.lines.map(
        (line) => line.status,
      ),
    ).toEqual(["unavailable", "unavailable"]);
  });

  test("a suspended shop and a hidden category make lines unavailable", async () => {
    const moderator = testAdmin(await seedUser(db, "admin"));
    const suspended = await seedApprovedMerchant(db);
    const item = await buyable(suspended);
    const added = await addCartItem(db, guest(), {
      quantity: 1,
      variantId: item.variantId,
    });
    await suspendMerchant(db, moderator, suspended.merchantId);
    expect(
      (await getCart(db, guest(tokenOf(added.cookie)))).view.groups[0]?.lines[0]
        ?.status,
    ).toBe("unavailable");

    const shop = await seedApprovedMerchant(db);
    const categoryId = await seedCategory(db);
    const hidden = await createProduct(
      db,
      shop,
      productInput({ categoryId }, { price: "100" }),
    );
    await addImageRow(db, hidden.id);
    await publishProduct(db, shop, hidden.id);
    const hiddenAdd = await addCartItem(db, guest(), {
      quantity: 1,
      variantId: hidden.variants[0]?.id ?? "",
    });
    await updateCategory(db, moderator, categoryId, { isActive: false });
    expect(
      (await getCart(db, guest(tokenOf(hiddenAdd.cookie)))).view.groups[0]
        ?.lines[0]?.status,
    ).toBe("unavailable");
  });

  test("a switched-off variant is unavailable", async () => {
    const shop = await seedApprovedMerchant(db);
    const { largeId } = await twoSizes(shop);
    const added = await addCartItem(db, guest(), {
      quantity: 1,
      variantId: largeId,
    });
    await updateVariant(db, shop, largeId, { isActive: false });
    expect(
      (await getCart(db, guest(tokenOf(added.cookie)))).view.groups[0]?.lines[0]
        ?.status,
    ).toBe("unavailable");
  });

  test("totals include only ok and price_changed lines, and groups follow the first line", async () => {
    const shop = await seedApprovedMerchant(db);
    const first = await buyable(shop, { price: "100", stock: 5 });
    const second = await buyable(shop, { price: "50", stock: 5 });
    const added = await addCartItem(db, guest(), {
      quantity: 2,
      variantId: first.variantId,
    });
    const token = tokenOf(added.cookie);
    await addCartItem(db, guest(token), {
      quantity: 1,
      variantId: second.variantId,
    });
    await unpublishProduct(db, shop, second.productId);
    const view = (await getCart(db, guest(token))).view;
    expect(view.groups).toHaveLength(1);
    expect(view.totalPaise).toBe(20_000);
    expect(view.groups[0]?.subtotalPaise).toBe(20_000);
  });
});

describe("merge on sign-in", () => {
  test("sums quantities, caps at 10, deletes the guest cart, and is a no-op the second time", async () => {
    const shop = await seedApprovedMerchant(db);
    const { variantId } = await buyable(shop, { stock: 20 });
    const userId = await seedUser(db);
    await addCartItem(db, signedIn(userId), { quantity: 6, variantId });

    const guestAdd = await addCartItem(db, guest(), {
      quantity: 6,
      variantId,
    });
    const token = tokenOf(guestAdd.cookie);
    const hash = hashGuestToken(token);

    const merged = await getCart(db, signedIn(userId, token));
    expect(merged.cookie).toEqual({ clear: true });
    expect(merged.view.groups[0]?.lines[0]?.quantity).toBe(10);
    expect(merged.view.mergeDropped).toBe(0);
    expect(await cartCount(hash)).toBe(0);

    const second = await getCart(db, signedIn(userId, token));
    expect(second.view.groups[0]?.lines[0]?.quantity).toBe(10);
    expect(second.view.mergeDropped).toBe(0);
  });

  test("a guest line is carried with the price the guest last saw", async () => {
    const shop = await seedApprovedMerchant(db);
    const { variantId } = await buyable(shop, { price: "100" });
    const guestAdd = await addCartItem(db, guest(), {
      quantity: 1,
      variantId,
    });
    await updateVariant(db, shop, variantId, { price: 130 });
    const userId = await seedUser(db);
    const merged = await getCart(
      db,
      signedIn(userId, tokenOf(guestAdd.cookie)),
    );
    expect(merged.view.groups[0]?.lines[0]?.status).toBe("price_changed");
  });

  test("drops guest lines beyond 30 and reports how many", async () => {
    const shop = await seedApprovedMerchant(db);
    const userId = await seedUser(db);
    for (let index = 0; index < 30; index += 1) {
      await addCartItem(db, signedIn(userId), {
        quantity: 1,
        variantId: (await buyable(shop)).variantId,
      });
    }
    const guestAdd = await addCartItem(db, guest(), {
      quantity: 1,
      variantId: (await buyable(shop)).variantId,
    });
    const merged = await getCart(
      db,
      signedIn(userId, tokenOf(guestAdd.cookie)),
    );
    expect(merged.view.mergeDropped).toBe(1);
    expect(merged.view.groups.flatMap((g) => g.lines)).toHaveLength(30);
  });

  test("an unknown guest token with a session is cleared and changes nothing", async () => {
    const userId = await seedUser(db);
    const result = await getCart(db, signedIn(userId, newToken()));
    expect(result.cookie).toEqual({ clear: true });
    expect(result.view.groups).toEqual([]);
  });
});

describe("concurrency", () => {
  test("concurrent adds of the same variant end with one line", async () => {
    const shop = await seedApprovedMerchant(db);
    const { variantId } = await buyable(shop, { stock: 10 });
    const first = await addCartItem(db, guest(), { quantity: 1, variantId });
    const token = tokenOf(first.cookie);
    await Promise.all([
      addCartItem(db, guest(token), { quantity: 1, variantId }),
      addCartItem(db, guest(token), { quantity: 1, variantId }),
    ]);
    const view = (await getCart(db, guest(token))).view;
    const lines = view.groups.flatMap((g) => g.lines);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.quantity).toBe(3);
  });
});

describe("remove", () => {
  test("removes the line and leaves the cart", async () => {
    const shop = await seedApprovedMerchant(db);
    const { variantId } = await buyable(shop);
    const added = await addCartItem(db, guest(), { quantity: 1, variantId });
    const token = tokenOf(added.cookie);
    const removed = await removeCartItem(db, guest(token), variantId);
    expect(removed.view.count).toBe(0);
    expect(removed.view.groups).toEqual([]);
  });
});

function newToken(): string {
  return createId() + createId();
}

async function productOf(variantId: string): Promise<string> {
  const { productVariantsTable } = await import("~/db/schema");
  const [row] = await db
    .select({ productId: productVariantsTable.productId })
    .from(productVariantsTable)
    .where(eq(productVariantsTable.id, variantId));
  return row?.productId ?? "";
}

function tokenOf(cookie: null | { clear: true } | { set: string }): string {
  if (!cookie || !("set" in cookie)) {
    throw new Error("expected a cookie to be set");
  }
  return cookie.set;
}
