import { db } from "~/db";
import { authorizeAdmin } from "~/modules/identity";
import { suspendMerchant } from "~/modules/merchants";
import { apiRoute, ok } from "~/platform/http";

export const POST = apiRoute(
  async (
    _request,
    context: RouteContext<"/api/v1/admin/merchants/[id]/suspend">,
  ) => {
    const admin = await authorizeAdmin();
    const { id } = await context.params;
    return ok(await suspendMerchant(db, admin, id));
  },
);
