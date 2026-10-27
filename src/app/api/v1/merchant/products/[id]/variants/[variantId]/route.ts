import { db } from "~/db";
import { updateVariant, variantPatchSchema } from "~/modules/catalog";
import { authorizeApprovedMerchant } from "~/modules/merchants";
import { apiRoute, ok, parseJson } from "~/platform/http";

/**
 * Edits a variant. The variant is found by its own id within the shop;
 * the product id in the path is not trusted for ownership.
 */
export const PATCH = apiRoute(
  async (
    request,
    context: RouteContext<"/api/v1/merchant/products/[id]/variants/[variantId]">,
  ) => {
    const merchant = await authorizeApprovedMerchant();
    const { variantId } = await context.params;
    const patch = await parseJson(request, variantPatchSchema);
    return ok(await updateVariant(db, merchant, variantId, patch));
  },
);
