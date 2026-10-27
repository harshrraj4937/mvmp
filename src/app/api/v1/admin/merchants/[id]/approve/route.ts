import { db } from "~/db";
import { authorizeAdmin } from "~/modules/identity";
import { approveMerchant } from "~/modules/merchants";
import { apiRoute, ok } from "~/platform/http";

export const POST = apiRoute(
  async (
    _request,
    context: RouteContext<"/api/v1/admin/merchants/[id]/approve">,
  ) => {
    const admin = await authorizeAdmin();
    const { id } = await context.params;
    return ok(await approveMerchant(db, admin, id));
  },
);
