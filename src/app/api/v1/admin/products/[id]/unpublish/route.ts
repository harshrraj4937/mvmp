import { db } from "~/db";
import { holdProduct, holdSchema } from "~/modules/catalog";
import { authorizeAdmin } from "~/modules/identity";
import { apiRoute, ok, parseJson } from "~/platform/http";

/** Takes a published product down with a reason the merchant sees (a hold). */
export const POST = apiRoute(
  async (
    request,
    context: RouteContext<"/api/v1/admin/products/[id]/unpublish">,
  ) => {
    const admin = await authorizeAdmin();
    const { id } = await context.params;
    const hold = await parseJson(request, holdSchema);
    return ok(await holdProduct(db, admin, id, hold));
  },
);
