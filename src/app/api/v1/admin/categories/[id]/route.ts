import { db } from "~/db";
import { categoryPatchSchema, updateCategory } from "~/modules/catalog";
import { authorizeAdmin } from "~/modules/identity";
import { apiRoute, ok, parseJson } from "~/platform/http";

/** Rename, reorder, or (de)activate a category. */
export const PATCH = apiRoute(
  async (request, context: RouteContext<"/api/v1/admin/categories/[id]">) => {
    const admin = await authorizeAdmin();
    const { id } = await context.params;
    const patch = await parseJson(request, categoryPatchSchema);
    return ok(await updateCategory(db, admin, id, patch));
  },
);
