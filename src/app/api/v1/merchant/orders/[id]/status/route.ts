import { db } from "~/db";
import { authorizeApprovedMerchant } from "~/modules/merchants";
import { advanceMerchantOrder, merchantStatusSchema } from "~/modules/orders";
import { apiRoute, ok, parseJson } from "~/platform/http";

/** Preparing, packing, packed: the maker's steps. */
export const POST = apiRoute(
  async (
    request,
    context: RouteContext<"/api/v1/merchant/orders/[id]/status">,
  ) => {
    const merchant = await authorizeApprovedMerchant();
    const { id } = await context.params;
    const { to } = await parseJson(request, merchantStatusSchema);
    return ok(await advanceMerchantOrder(db, merchant, id, to));
  },
);
