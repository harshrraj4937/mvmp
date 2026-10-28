import { createId } from "@paralleldrive/cuid2";

import type { Database } from "~/db";

import { addCartItem } from "~/modules/cart/application/cart";
import { createAddress } from "~/modules/orders/application/addresses";
import { addressSchema } from "~/modules/orders/presentation/schemas";

import { publishedProduct, seedApprovedMerchant } from "./catalog";
import { seedUser } from "./merchants";

/** A delivery address for `userId`; returns its id. */
export async function seedAddress(db: Database, userId: string) {
  const address = await createAddress(
    db,
    userId,
    addressSchema.parse({
      city: "Panaji",
      fullName: "Asha Naik",
      landmark: "Near the chapel",
      line1: "12 Fontainhas Road",
      phone: "9876543210",
      postalCode: "403001",
      state: "goa",
    }),
  );
  return address.id;
}

/**
 * A shopper with a saved address and a cart from two approved shops: one
 * ₹349 piece from shop A (added first), two ₹250 pieces from shop B.
 */
export async function seedCartOrder(
  db: Database,
  { stockA = 5, stockB = 5 }: { stockA?: number; stockB?: number } = {},
) {
  const userId = await seedUser(db);
  const addressId = await seedAddress(db, userId);
  const shopA = await seedApprovedMerchant(db);
  const shopB = await seedApprovedMerchant(db);
  const productA = await publishedProduct(db, shopA, {
    price: "349",
    stock: stockA,
  });
  const productB = await publishedProduct(db, shopB, {
    price: "250",
    stock: stockB,
  });
  const owner = { guestToken: null, userId };
  await addCartItem(db, owner, { quantity: 1, variantId: productA.variantId });
  await addCartItem(db, owner, { quantity: 2, variantId: productB.variantId });
  return {
    addressId,
    input: {
      addressId,
      checkoutKey: `key_${createId()}`,
      expectedTotalPaise: 84_900,
      paymentMethod: "COD" as const,
    },
    productA,
    productB,
    shopA,
    shopB,
    userId,
  };
}
