import { db } from "~/db";
import { archiveProduct } from "~/modules/catalog";
import { authorizeApprovedMerchant } from "~/modules/merchants";
import { apiRoute, ok } from "~/platform/http";

export const POST = apiRoute(
  async (
    _request,
    context: RouteContext<"/api/v1/merchant/products/[id]/archive">,
  ) => {
    const merchant = await authorizeApprovedMerchant();
    const { id } = await context.params;
    return ok(await archiveProduct(db, merchant, id));
  },
);
