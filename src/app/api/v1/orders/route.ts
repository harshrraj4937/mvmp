import { cookies } from "next/headers";

import { db } from "~/db";
import { applyCartCookie, getCart, GUEST_CART_COOKIE } from "~/modules/cart";
import { authorizeSession } from "~/modules/identity";
import {
  listShopperOrders,
  placeOrder,
  placeOrderSchema,
} from "~/modules/orders";
import { apiRoute, ok, parseJson } from "~/platform/http";

/** The shopper's orders, newest first. */
export const GET = apiRoute(async () => {
  const user = await authorizeSession();
  return ok(await listShopperOrders(db, user.id));
});

/** Places a cash-on-delivery order from the shopper's cart (spec §7). */
export const POST = apiRoute(async (request) => {
  const user = await authorizeSession();
  const input = await parseJson(request, placeOrderSchema);
  // Reading the cart merges a guest cart left in this browser first.
  const store = await cookies();
  const cart = await getCart(db, {
    guestToken: store.get(GUEST_CART_COOKIE)?.value ?? null,
    userId: user.id,
  });
  await applyCartCookie(cart.cookie);
  const { created, order } = await placeOrder(db, user.id, input);
  return ok(order, created ? 201 : 200);
});
