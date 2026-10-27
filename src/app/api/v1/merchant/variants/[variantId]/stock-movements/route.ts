import { db } from "~/db";
import { listStockMovements } from "~/modules/catalog";
import { authorizeApprovedMerchant } from "~/modules/merchants";
import { apiRoute, ok } from "~/platform/http";

/** The variant's latest stock movements, newest first. */
export const GET = apiRoute(
  async (
    _request,
    context: RouteContext<"/api/v1/merchant/variants/[variantId]/stock-movements">,
  ) => {
    const merchant = await authorizeApprovedMerchant();
    const { variantId } = await context.params;
    return ok(await listStockMovements(db, merchant, variantId));
  },
);
