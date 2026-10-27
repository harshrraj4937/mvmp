import { db } from "~/db";
import {
  addPickupLocation,
  authorizeMerchant,
  listPickupLocations,
  pickupLocationCreateSchema,
} from "~/modules/merchants";
import { apiRoute, ok, parseJson } from "~/platform/http";

export const GET = apiRoute(async () => {
  const merchant = await authorizeMerchant();
  return ok(await listPickupLocations(db, merchant));
});

export const POST = apiRoute(async (request) => {
  const merchant = await authorizeMerchant();
  const input = await parseJson(request, pickupLocationCreateSchema);
  return ok(await addPickupLocation(db, merchant, input), 201);
});
