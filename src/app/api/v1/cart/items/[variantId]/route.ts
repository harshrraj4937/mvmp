import { db } from "~/db";
import {
  applyCartCookie,
  cartUpdateSchema,
  parseCartBody,
  readCartOwner,
  removeCartItem,
  updateCartItem,
} from "~/modules/cart";
import { apiRoute, ok } from "~/platform/http";

/** Changes a line's quantity, or acknowledges its new price. Public. */
export const PATCH = apiRoute(
  async (request, context: RouteContext<"/api/v1/cart/items/[variantId]">) => {
    const { variantId } = await context.params;
    const change = await parseCartBody(request, cartUpdateSchema);
    const result = await updateCartItem(
      db,
      await readCartOwner(),
      variantId,
      change,
    );
    await applyCartCookie(result.cookie);
    return ok(result.view);
  },
);

/** Removes a line from the cart. Public. */
export const DELETE = apiRoute(
  async (_request, context: RouteContext<"/api/v1/cart/items/[variantId]">) => {
    const { variantId } = await context.params;
    const result = await removeCartItem(db, await readCartOwner(), variantId);
    await applyCartCookie(result.cookie);
    return ok(result.view);
  },
);
