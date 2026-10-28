import { db } from "~/db";
import { getStorefrontProduct } from "~/modules/catalog";
import { NotFoundError } from "~/platform/errors";
import { apiRoute, ok } from "~/platform/http";

/** One purchasable product of a shop. Public. */
export const GET = apiRoute(
  async (
    _request,
    context: RouteContext<"/api/v1/shops/[shop]/products/[product]">,
  ) => {
    const { product, shop } = await context.params;
    const found = await getStorefrontProduct(db, shop, product);
    if (!found) {
      throw new NotFoundError("Product not found.");
    }
    return ok(found);
  },
);
