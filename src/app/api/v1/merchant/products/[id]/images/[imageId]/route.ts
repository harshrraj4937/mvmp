import { db } from "~/db";
import {
  deleteProductImage,
  getImageStorage,
  imagePatchSchema,
  updateProductImage,
} from "~/modules/catalog";
import { authorizeApprovedMerchant } from "~/modules/merchants";
import { apiRoute, ok, parseJson } from "~/platform/http";

// The image is found by its own id within the shop; the product id in the
// path is not trusted for ownership.
type Context = RouteContext<"/api/v1/merchant/products/[id]/images/[imageId]">;

export const PATCH = apiRoute(async (request, context: Context) => {
  const merchant = await authorizeApprovedMerchant();
  const { imageId } = await context.params;
  const patch = await parseJson(request, imagePatchSchema);
  return ok(await updateProductImage(db, merchant, imageId, patch));
});

export const DELETE = apiRoute(async (_request, context: Context) => {
  const merchant = await authorizeApprovedMerchant();
  const { imageId } = await context.params;
  await deleteProductImage(db, getImageStorage(), merchant, imageId);
  return ok(null);
});
