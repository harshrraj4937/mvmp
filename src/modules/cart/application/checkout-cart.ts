import { and, asc, eq, inArray } from "drizzle-orm";

import type { Database } from "~/db";

import { cartItemsTable, cartsTable } from "~/db/schema";

export interface LockedCart {
  cartId: string;
  lines: {
    createdAt: Date;
    quantity: number;
    unitPricePaiseSeen: number;
    variantId: string;
  }[];
}

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Locks a signed-in shopper's cart for checkout and returns its lines in the
 * order they were added. Null when the shopper has no cart.
 */
export async function lockUserCart(
  tx: Transaction,
  userId: string,
): Promise<LockedCart | null> {
  const [cart] = await tx
    .select({ id: cartsTable.id })
    .from(cartsTable)
    .where(eq(cartsTable.userId, userId))
    .for("update");
  if (!cart) {
    return null;
  }
  const lines = await tx
    .select({
      createdAt: cartItemsTable.createdAt,
      quantity: cartItemsTable.quantity,
      unitPricePaiseSeen: cartItemsTable.unitPricePaiseSeen,
      variantId: cartItemsTable.variantId,
    })
    .from(cartItemsTable)
    .where(eq(cartItemsTable.cartId, cart.id))
    .orderBy(asc(cartItemsTable.createdAt), asc(cartItemsTable.id));
  return { cartId: cart.id, lines };
}

/** Removes the ordered lines from the cart. */
export async function removeCartLines(
  tx: Transaction,
  cartId: string,
  variantIds: string[],
): Promise<void> {
  if (variantIds.length === 0) {
    return;
  }
  await tx
    .delete(cartItemsTable)
    .where(
      and(
        eq(cartItemsTable.cartId, cartId),
        inArray(cartItemsTable.variantId, variantIds),
      ),
    );
}
