import { asc, desc, eq, sql } from "drizzle-orm";

import type { Database } from "~/db";

import { merchantMembersTable, merchantsTable } from "~/db/schema";

import type { MerchantRole } from "../domain/profile-rules";
import type { MerchantStatus } from "../domain/status";

/**
 * The merchant a signed-in user acts for, taken from their membership.
 * Merchant-scoped services take this instead of a merchant id, so the id
 * can never come from the request.
 */
export interface MerchantContext {
  merchantId: string;
  role: MerchantRole;
  slug: string;
  status: MerchantStatus;
  storeName: string;
  userId: string;
}

/**
 * The user's merchant: the one they own, otherwise their oldest staff
 * membership (ADR-023). Null when they belong to no merchant.
 */
export async function findMerchantForUser(
  db: Database,
  userId: string,
): Promise<MerchantContext | null> {
  const [row] = await db
    .select({
      merchantId: merchantsTable.id,
      role: merchantMembersTable.role,
      slug: merchantsTable.slug,
      status: merchantsTable.status,
      storeName: merchantsTable.storeName,
    })
    .from(merchantMembersTable)
    .innerJoin(
      merchantsTable,
      eq(merchantsTable.id, merchantMembersTable.merchantId),
    )
    .where(eq(merchantMembersTable.userId, userId))
    .orderBy(
      desc(sql`${merchantMembersTable.role} = 'owner'`),
      asc(merchantMembersTable.createdAt),
    )
    .limit(1);
  return row ? { ...row, userId } : null;
}
