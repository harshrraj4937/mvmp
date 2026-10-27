import { db } from "~/db";
import { authorizeSession } from "~/modules/identity";
import {
  getMerchantProfile,
  onboardingSchema,
  registerMerchant,
} from "~/modules/merchants";
import { apiRoute, ok, parseJson } from "~/platform/http";

/** Creates the caller's shop as a DRAFT, owned by the caller. */
export const POST = apiRoute(async (request) => {
  const user = await authorizeSession();
  const input = await parseJson(request, onboardingSchema);
  const merchant = await registerMerchant(db, user, input);
  return ok(await getMerchantProfile(db, merchant), 201);
});
