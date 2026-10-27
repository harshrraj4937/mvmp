import { db } from "~/db";
import { authorizeMerchant, submitMerchant } from "~/modules/merchants";
import { apiRoute, ok } from "~/platform/http";

/** Sends the caller's shop to the admin review queue. */
export const POST = apiRoute(async () => {
  const merchant = await authorizeMerchant();
  return ok(await submitMerchant(db, merchant));
});
