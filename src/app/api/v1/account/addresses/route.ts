import { db } from "~/db";
import { authorizeSession } from "~/modules/identity";
import { addressSchema, createAddress, listAddresses } from "~/modules/orders";
import { apiRoute, ok, parseJson } from "~/platform/http";

export const GET = apiRoute(async () => {
  const user = await authorizeSession();
  return ok(await listAddresses(db, user.id));
});

export const POST = apiRoute(async (request) => {
  const user = await authorizeSession();
  const input = await parseJson(request, addressSchema);
  return ok(await createAddress(db, user.id, input), 201);
});
