import { db } from "~/db";
import { addVariant, variantCreateSchema } from "~/modules/catalog";
import { authorizeApprovedMerchant } from "~/modules/merchants";
import { apiRoute, ok, parseJson } from "~/platform/http";

/** Adds a labelled variant with opening stock; returns the product. */
export const POST = apiRoute(
  async (
    request,
    context: RouteContext<"/api/v1/merchant/products/[id]/variants">,
  ) => {
    const merchant = await authorizeApprovedMerchant();
    const { id } = await context.params;
    const input = await parseJson(request, variantCreateSchema);
    return ok(await addVariant(db, merchant, id, input), 201);
  },
);
