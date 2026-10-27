import { db } from "~/db";
import { authorizeAdmin } from "~/modules/identity";
import { reinstateMerchant } from "~/modules/merchants";
import { apiRoute, ok } from "~/platform/http";

export const POST = apiRoute(
  async (
    _request,
    context: RouteContext<"/api/v1/admin/merchants/[id]/reinstate">,
  ) => {
    const admin = await authorizeAdmin();
    const { id } = await context.params;
    return ok(await reinstateMerchant(db, admin, id));
  },
);
