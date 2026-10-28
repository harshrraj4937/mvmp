import { db } from "~/db";
import { authorizeApprovedMerchant } from "~/modules/merchants";
import {
  listMerchantOrders,
  merchantOrderListQuerySchema,
} from "~/modules/orders";
import { apiRoute, ok, parseQuery } from "~/platform/http";

/** The shop's parts of orders, newest first, 25 a page. */
export const GET = apiRoute(async (request) => {
  const merchant = await authorizeApprovedMerchant();
  const query = parseQuery(request, merchantOrderListQuerySchema);
  return ok(await listMerchantOrders(db, merchant, query));
});
