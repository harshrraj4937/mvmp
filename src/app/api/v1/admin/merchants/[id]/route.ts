import { db } from "~/db";
import { authorizeAdmin } from "~/modules/identity";
import { getMerchantForAdmin } from "~/modules/merchants";
import { apiRoute, ok } from "~/platform/http";

export const GET = apiRoute(
  async (_request, context: RouteContext<"/api/v1/admin/merchants/[id]">) => {
    const admin = await authorizeAdmin();
    const { id } = await context.params;
    return ok(await getMerchantForAdmin(db, admin, id));
  },
);
