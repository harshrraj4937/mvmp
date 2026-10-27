import { z } from "zod";

import { db } from "~/db";
import { authorizeAdmin } from "~/modules/identity";
import { listMerchants, MERCHANT_STATUSES } from "~/modules/merchants";
import { ValidationError } from "~/platform/errors";
import { apiRoute, ok } from "~/platform/http";

const statusFilter = z.enum(MERCHANT_STATUSES).optional();

/** The merchant review queue, optionally filtered with ?status=. */
export const GET = apiRoute(async (request) => {
  const admin = await authorizeAdmin();
  const raw = new URL(request.url).searchParams.get("status") ?? undefined;
  const status = statusFilter.safeParse(raw);
  if (!status.success) {
    throw new ValidationError("Unknown merchant status.", {
      status: [`Use one of ${MERCHANT_STATUSES.join(", ")}.`],
    });
  }
  return ok(await listMerchants(db, admin, { status: status.data }));
});
