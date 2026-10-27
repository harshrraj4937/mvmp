import { db } from "~/db";
import {
  getProduct,
  productPatchSchema,
  updateProduct,
} from "~/modules/catalog";
import { authorizeApprovedMerchant } from "~/modules/merchants";
import { apiRoute, ok, parseJson } from "~/platform/http";

type Context = RouteContext<"/api/v1/merchant/products/[id]">;

export const GET = apiRoute(async (_request, context: Context) => {
  const merchant = await authorizeApprovedMerchant();
  const { id } = await context.params;
  return ok(await getProduct(db, merchant, id));
});

export const PATCH = apiRoute(async (request, context: Context) => {
  const merchant = await authorizeApprovedMerchant();
  const { id } = await context.params;
  const patch = await parseJson(request, productPatchSchema);
  return ok(await updateProduct(db, merchant, id, patch));
});
