import { db } from "~/db";
import {
  listProductsForAdmin,
  productListQuerySchema,
} from "~/modules/catalog";
import { authorizeAdmin } from "~/modules/identity";
import { apiRoute, ok, parseQuery } from "~/platform/http";

/** Every shop's products; `?status` filters. */
export const GET = apiRoute(async (request) => {
  const admin = await authorizeAdmin();
  const { status } = parseQuery(request, productListQuerySchema);
  return ok(await listProductsForAdmin(db, admin, { status }));
});
