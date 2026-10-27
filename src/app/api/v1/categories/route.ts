import { db } from "~/db";
import { listActiveCategories } from "~/modules/catalog";
import { apiRoute, ok } from "~/platform/http";

/** Active categories, in display order. Public. */
export const GET = apiRoute(async () => ok(await listActiveCategories(db)));
