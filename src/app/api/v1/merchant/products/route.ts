import { db } from "~/db";
import {
  createProduct,
  listProducts,
  productCreateSchema,
  productListQuerySchema,
} from "~/modules/catalog";
import { authorizeApprovedMerchant } from "~/modules/merchants";
import { apiRoute, ok, parseJson, parseQuery } from "~/platform/http";

/** The shop's products; `?q` searches name and SKU, `?status` filters. */
export const GET = apiRoute(async (request) => {
  const merchant = await authorizeApprovedMerchant();
  const filter = parseQuery(request, productListQuerySchema);
  return ok(await listProducts(db, merchant, filter));
});

/** A new DRAFT product with its first variant and opening stock. */
export const POST = apiRoute(async (request) => {
  const merchant = await authorizeApprovedMerchant();
  const input = await parseJson(request, productCreateSchema);
  return ok(await createProduct(db, merchant, input), 201);
});
