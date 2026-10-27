import { db } from "~/db";
import { authorizeAdmin } from "~/modules/identity";
import { rejectMerchant, rejectSchema } from "~/modules/merchants";
import { apiRoute, ok, parseJson } from "~/platform/http";

export const POST = apiRoute(
  async (
    request,
    context: RouteContext<"/api/v1/admin/merchants/[id]/reject">,
  ) => {
    const admin = await authorizeAdmin();
    const { id } = await context.params;
    const { reason } = await parseJson(request, rejectSchema);
    return ok(await rejectMerchant(db, admin, id, reason));
  },
);
