import { db } from "~/db";
import { releaseProduct } from "~/modules/catalog";
import { authorizeAdmin } from "~/modules/identity";
import { apiRoute, ok } from "~/platform/http";

/** Clears a hold; the merchant can then publish the product again. */
export const POST = apiRoute(
  async (
    _request,
    context: RouteContext<"/api/v1/admin/products/[id]/release">,
  ) => {
    const admin = await authorizeAdmin();
    const { id } = await context.params;
    return ok(await releaseProduct(db, admin, id));
  },
);
