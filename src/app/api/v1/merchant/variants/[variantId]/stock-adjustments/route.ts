import { db } from "~/db";
import { adjustStock, stockAdjustmentSchema } from "~/modules/catalog";
import { authorizeApprovedMerchant } from "~/modules/merchants";
import { apiRoute, ok, parseJson } from "~/platform/http";

/** Adds or removes stock with a reason; never below zero (409). */
export const POST = apiRoute(
  async (
    request,
    context: RouteContext<"/api/v1/merchant/variants/[variantId]/stock-adjustments">,
  ) => {
    const merchant = await authorizeApprovedMerchant();
    const { variantId } = await context.params;
    const adjustment = await parseJson(request, stockAdjustmentSchema);
    return ok(await adjustStock(db, merchant, variantId, adjustment));
  },
);
