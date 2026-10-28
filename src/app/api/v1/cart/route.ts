import { db } from "~/db";
import { applyCartCookie, getCart, readCartOwner } from "~/modules/cart";
import { apiRoute, ok } from "~/platform/http";

/** The shopper's cart, grouped by shop, with each line's status. Public. */
export const GET = apiRoute(async () => {
  const result = await getCart(db, await readCartOwner());
  await applyCartCookie(result.cookie);
  return ok(result.view);
});
