import { db } from "~/db";
import { getStorefrontShop } from "~/modules/catalog";
import { NotFoundError } from "~/platform/errors";
import { apiRoute, ok } from "~/platform/http";

/** A shop with a complete story and its purchasable products. Public. */
export const GET = apiRoute(
  async (_request, context: RouteContext<"/api/v1/shops/[shop]">) => {
    const { shop } = await context.params;
    const found = await getStorefrontShop(db, shop);
    if (!found) {
      throw new NotFoundError("Shop not found.");
    }
    return ok(found);
  },
);
