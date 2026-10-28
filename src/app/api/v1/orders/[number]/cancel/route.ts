import { db } from "~/db";
import { authorizeSession } from "~/modules/identity";
import { cancelShopperOrder, shopperCancelSchema } from "~/modules/orders";
import { apiRoute, ok, parseJson } from "~/platform/http";

/** Cancels one parcel, or every parcel not yet delivered. */
export const POST = apiRoute(
  async (request, context: RouteContext<"/api/v1/orders/[number]/cancel">) => {
    const user = await authorizeSession();
    const { number } = await context.params;
    const input = await parseJson(request, shopperCancelSchema);
    return ok(await cancelShopperOrder(db, user.id, number, input));
  },
);
