import { db } from "~/db";
import { getImageStorage, imagePatchSchema } from "~/modules/catalog";
import {
  authorizeMerchant,
  deleteStoryImage,
  updateStoryImage,
} from "~/modules/merchants";
import { apiRoute, ok, parseJson } from "~/platform/http";

type Context = RouteContext<"/api/v1/merchant/story/images/[imageId]">;

export const PATCH = apiRoute(async (request, context: Context) => {
  const merchant = await authorizeMerchant();
  const { imageId } = await context.params;
  const patch = await parseJson(request, imagePatchSchema);
  return ok(await updateStoryImage(db, merchant, imageId, patch));
});

export const DELETE = apiRoute(async (_request, context: Context) => {
  const merchant = await authorizeMerchant();
  const { imageId } = await context.params;
  await deleteStoryImage(db, getImageStorage(), merchant, imageId);
  return ok(null);
});
