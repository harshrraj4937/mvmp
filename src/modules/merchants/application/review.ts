import { and, asc, eq, sql } from "drizzle-orm";

import type { Database } from "~/db";
import type { AdminActor } from "~/modules/identity";

import {
  merchantMembersTable,
  merchantPickupLocationsTable,
  merchantsTable,
  userTable,
} from "~/db/schema";

import type { MerchantStatus } from "../domain/status";

import { type PickupLocation, toPickupLocation } from "./pickup";
import { type MerchantProfile, toMerchantProfile } from "./profile";
import { loadMerchantRow, transitionMerchant } from "./transition";

export interface MerchantAdminDetail extends MerchantProfile {
  ownerEmail: null | string;
  pickupLocations: PickupLocation[];
  reviewedBy: null | string;
}

export interface MerchantListItem {
  contactEmail: string;
  createdAt: Date;
  id: string;
  ownerEmail: null | string;
  slug: string;
  status: MerchantStatus;
  storeName: string;
  submittedAt: Date | null;
}

export async function approveMerchant(
  db: Database,
  admin: AdminActor,
  merchantId: string,
): Promise<MerchantProfile> {
  return review(db, admin, merchantId, "APPROVED", ["SUBMITTED"]);
}

export async function getMerchantForAdmin(
  db: Database,
  _admin: AdminActor,
  merchantId: string,
): Promise<MerchantAdminDetail> {
  const row = await loadMerchantRow(db, merchantId);
  const [owner] = await ownerEmails(db, merchantId);
  const pickups = await db
    .select()
    .from(merchantPickupLocationsTable)
    .where(eq(merchantPickupLocationsTable.merchantId, merchantId))
    .orderBy(
      sql`${merchantPickupLocationsTable.isPrimary} desc`,
      asc(merchantPickupLocationsTable.createdAt),
    );
  return {
    ...toMerchantProfile(row),
    ownerEmail: owner?.email ?? null,
    pickupLocations: pickups.map(toPickupLocation),
    reviewedBy: row.reviewedBy,
  };
}

/** The review queue: oldest submissions first. */
export async function listMerchants(
  db: Database,
  _admin: AdminActor,
  filter: { status?: MerchantStatus },
): Promise<MerchantListItem[]> {
  return db
    .select({
      contactEmail: merchantsTable.contactEmail,
      createdAt: merchantsTable.createdAt,
      id: merchantsTable.id,
      ownerEmail: userTable.email,
      slug: merchantsTable.slug,
      status: merchantsTable.status,
      storeName: merchantsTable.storeName,
      submittedAt: merchantsTable.submittedAt,
    })
    .from(merchantsTable)
    .leftJoin(
      merchantMembersTable,
      and(
        eq(merchantMembersTable.merchantId, merchantsTable.id),
        eq(merchantMembersTable.role, "owner"),
      ),
    )
    .leftJoin(userTable, eq(userTable.id, merchantMembersTable.userId))
    .where(filter.status ? eq(merchantsTable.status, filter.status) : undefined)
    .orderBy(
      sql`${merchantsTable.submittedAt} asc nulls last`,
      asc(merchantsTable.createdAt),
    );
}

export async function reinstateMerchant(
  db: Database,
  admin: AdminActor,
  merchantId: string,
): Promise<MerchantProfile> {
  return review(db, admin, merchantId, "APPROVED", ["SUSPENDED"]);
}

export async function rejectMerchant(
  db: Database,
  admin: AdminActor,
  merchantId: string,
  reason: string,
): Promise<MerchantProfile> {
  return review(db, admin, merchantId, "REJECTED", ["SUBMITTED"], reason);
}

export async function suspendMerchant(
  db: Database,
  admin: AdminActor,
  merchantId: string,
): Promise<MerchantProfile> {
  return review(db, admin, merchantId, "SUSPENDED", ["APPROVED"]);
}

function ownerEmails(db: Database, merchantId: string) {
  return db
    .select({ email: userTable.email })
    .from(merchantMembersTable)
    .innerJoin(userTable, eq(userTable.id, merchantMembersTable.userId))
    .where(
      and(
        eq(merchantMembersTable.merchantId, merchantId),
        eq(merchantMembersTable.role, "owner"),
      ),
    );
}

async function review(
  db: Database,
  admin: AdminActor,
  merchantId: string,
  to: MerchantStatus,
  from: readonly MerchantStatus[],
  reason?: string,
): Promise<MerchantProfile> {
  const row = await transitionMerchant(
    db,
    merchantId,
    to,
    {
      rejectionReason: to === "REJECTED" ? reason : undefined,
      reviewedAt: new Date(),
      reviewedBy: admin.id,
    },
    from,
  );
  return toMerchantProfile(row);
}
