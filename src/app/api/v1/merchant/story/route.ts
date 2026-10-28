import { db } from "~/db";
import {
  authorizeMerchant,
  getMerchantStory,
  merchantStoryPatchSchema,
  updateMerchantStory,
} from "~/modules/merchants";
import { apiRoute, ok, parseJson } from "~/platform/http";

// Any member of any shop status can write the story, so it is ready when
// the shop is approved.
export const GET = apiRoute(async () => {
  const merchant = await authorizeMerchant();
  return ok(await getMerchantStory(db, merchant));
});

export const PATCH = apiRoute(async (request) => {
  const merchant = await authorizeMerchant();
  const patch = await parseJson(request, merchantStoryPatchSchema);
  return ok(await updateMerchantStory(db, merchant, patch));
});
