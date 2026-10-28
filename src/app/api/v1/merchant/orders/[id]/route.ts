import { db } from "~/db";
import { authorizeApprovedMerchant } from "~/modules/merchants";
import { getMerchantOrder } from "~/modules/orders";
import { apiRoute, ok } from "~/platform/http";

export const GET = apiRoute(
  async (_request, context: RouteContext<"/api/v1/merchant/orders/[id]">) => {
    const merchant = await authorizeApprovedMerchant();
    const { id } = await context.params;
    return ok(await getMerchantOrder(db, merchant, id));
  },
);
