import { db } from "~/db";
import {
  addCartItem,
  applyCartCookie,
  cartAddSchema,
  parseCartBody,
  readCartOwner,
} from "~/modules/cart";
import { apiRoute, ok } from "~/platform/http";

/** Adds a product to the cart. Public; guests get the cart cookie. */
export const POST = apiRoute(async (request) => {
  const input = await parseCartBody(request, cartAddSchema);
  const result = await addCartItem(db, await readCartOwner(), input);
  await applyCartCookie(result.cookie);
  return ok(result.view, 201);
});
