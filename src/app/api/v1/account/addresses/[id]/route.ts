import { db } from "~/db";
import { authorizeSession } from "~/modules/identity";
import {
  addressPatchSchema,
  deleteAddress,
  updateAddress,
} from "~/modules/orders";
import { apiRoute, ok, parseJson } from "~/platform/http";

type Context = RouteContext<"/api/v1/account/addresses/[id]">;

export const PATCH = apiRoute(async (request, context: Context) => {
  const user = await authorizeSession();
  const { id } = await context.params;
  const patch = await parseJson(request, addressPatchSchema);
  return ok(await updateAddress(db, user.id, id, patch));
});

export const DELETE = apiRoute(async (_request, context: Context) => {
  const user = await authorizeSession();
  const { id } = await context.params;
  await deleteAddress(db, user.id, id);
  return ok(null);
});
