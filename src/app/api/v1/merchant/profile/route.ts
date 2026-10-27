import { db } from "~/db";
import {
  authorizeMerchant,
  getMerchantProfile,
  profilePatchSchema,
  updateMerchantProfile,
} from "~/modules/merchants";
import { apiRoute, ok, parseJson } from "~/platform/http";

export const GET = apiRoute(async () => {
  const merchant = await authorizeMerchant();
  return ok(await getMerchantProfile(db, merchant));
});

export const PATCH = apiRoute(async (request) => {
  const merchant = await authorizeMerchant();
  const patch = await parseJson(request, profilePatchSchema);
  return ok(await updateMerchantProfile(db, merchant, patch));
});
