import { db } from "~/db";
import { searchStorefront, storefrontQuerySchema } from "~/modules/catalog";
import { apiRoute, ok, parseQuery } from "~/platform/http";

/** Purchasable products: `?q`, `?category`, `?made`, `?region`, `?sort`, `?page`. Public. */
export const GET = apiRoute(async (request) => {
  const query = parseQuery(request, storefrontQuerySchema);
  return ok(await searchStorefront(db, query));
});
