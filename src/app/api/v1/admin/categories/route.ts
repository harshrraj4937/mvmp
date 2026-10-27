import { db } from "~/db";
import {
  categoryCreateSchema,
  createCategory,
  listCategories,
} from "~/modules/catalog";
import { authorizeAdmin } from "~/modules/identity";
import { apiRoute, ok, parseJson } from "~/platform/http";

export const GET = apiRoute(async () => {
  const admin = await authorizeAdmin();
  return ok(await listCategories(db, admin));
});

export const POST = apiRoute(async (request) => {
  const admin = await authorizeAdmin();
  const input = await parseJson(request, categoryCreateSchema);
  return ok(await createCategory(db, admin, input), 201);
});
