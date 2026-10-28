import { db } from "~/db";
import { authorizeApprovedMerchant } from "~/modules/merchants";
import { cancelMerchantOrder, merchantCancelSchema } from "~/modules/orders";
import { apiRoute, ok, parseJson } from "~/platform/http";

export const POST = apiRoute(
  async (
    request,
    context: RouteContext<"/api/v1/merchant/orders/[id]/cancel">,
  ) => {
    const merchant = await authorizeApprovedMerchant();
    const { id } = await context.params;
    const input = await parseJson(request, merchantCancelSchema);
    return ok(await cancelMerchantOrder(db, merchant, id, input));
  },
);
