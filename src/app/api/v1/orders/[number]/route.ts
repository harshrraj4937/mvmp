import { db } from "~/db";
import { authorizeSession } from "~/modules/identity";
import { getShopperOrder } from "~/modules/orders";
import { apiRoute, ok } from "~/platform/http";

export const GET = apiRoute(
  async (_request, context: RouteContext<"/api/v1/orders/[number]">) => {
    const user = await authorizeSession();
    const { number } = await context.params;
    return ok(await getShopperOrder(db, user.id, number));
  },
);
