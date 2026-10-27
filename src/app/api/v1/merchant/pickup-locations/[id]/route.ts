import { db } from "~/db";
import {
  authorizeMerchant,
  pickupLocationPatchSchema,
  updatePickupLocation,
} from "~/modules/merchants";
import { apiRoute, ok, parseJson } from "~/platform/http";

export const PATCH = apiRoute(
  async (
    request,
    context: RouteContext<"/api/v1/merchant/pickup-locations/[id]">,
  ) => {
    const merchant = await authorizeMerchant();
    const { id } = await context.params;
    const patch = await parseJson(request, pickupLocationPatchSchema);
    return ok(await updatePickupLocation(db, merchant, id, patch));
  },
);
