import { and, eq, inArray } from "drizzle-orm";

import type { Database } from "~/db";

import { merchantsTable } from "~/db/schema";
import { ConflictError, NotFoundError } from "~/platform/errors";

import {
  assertTransition,
  type MerchantStatus,
  statusesAllowedBefore,
} from "../domain/status";

export type MerchantRow = typeof merchantsTable.$inferSelect;

export async function loadMerchantRow(
  db: Database,
  merchantId: string,
): Promise<MerchantRow> {
  const [row] = await db
    .select()
    .from(merchantsTable)
    .where(eq(merchantsTable.id, merchantId));
  if (!row) {
    throw new NotFoundError("Shop not found.");
  }
  return row;
}

/**
 * Moves a merchant to `to` with one guarded UPDATE, so concurrent actions
 * on the same merchant cannot both succeed: the loser matches no row.
 * `from` narrows the allowed source states (e.g. reinstate: SUSPENDED only).
 */
export async function transitionMerchant(
  db: Database,
  merchantId: string,
  to: MerchantStatus,
  changes: Partial<typeof merchantsTable.$inferInsert> = {},
  from: readonly MerchantStatus[] = statusesAllowedBefore(to),
): Promise<MerchantRow> {
  const [row] = await db
    .update(merchantsTable)
    .set({ ...changes, status: to })
    .where(
      and(
        eq(merchantsTable.id, merchantId),
        inArray(merchantsTable.status, [...from]),
      ),
    )
    .returning();
  if (row) {
    return row;
  }

  const current = await loadMerchantRow(db, merchantId);
  assertTransition(current.status, to);
  // Allowed in general, but not by this action (or lost a race).
  throw new ConflictError(
    "invalid_transition",
    "The shop changed in the meantime. Reload and try again.",
  );
}
