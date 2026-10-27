import { and, eq } from "drizzle-orm";

import type { Database } from "~/db";

import { merchantsTable } from "~/db/schema";
import { uniqueViolation } from "~/platform/db-errors";
import { ConflictError, ForbiddenError } from "~/platform/errors";

import type { MerchantStatus } from "../domain/status";
import type { PostalAddress, ProfilePatch } from "../presentation/schemas";
import type { MerchantContext } from "./membership";

import {
  canManageProfile,
  lockedFieldsFor,
  type ProfileField,
} from "../domain/profile-rules";
import { slugTaken } from "./register";
import {
  loadMerchantRow,
  type MerchantRow,
  transitionMerchant,
} from "./transition";

export interface MerchantProfile {
  businessAddress: PostalAddress;
  complianceNotes: null | string;
  complianceVerified: boolean;
  contactEmail: string;
  contactName: string;
  contactPhone: string;
  description: null | string;
  fssaiLicense: null | string;
  gstin: null | string;
  id: string;
  logoUrl: null | string;
  pan: null | string;
  rejectionReason: null | string;
  returnAddress: PostalAddress;
  reviewedAt: Date | null;
  slug: string;
  status: MerchantStatus;
  storeName: string;
  submittedAt: Date | null;
}

const nullableFields: readonly ProfileField[] = [
  "complianceNotes",
  "description",
  "fssaiLicense",
  "gstin",
  "logoUrl",
  "pan",
];

export async function getMerchantProfile(
  db: Database,
  ctx: MerchantContext,
): Promise<MerchantProfile> {
  return toMerchantProfile(await loadMerchantRow(db, ctx.merchantId));
}

/** Owner only: DRAFT or REJECTED → SUBMITTED for admin review. */
export async function submitMerchant(
  db: Database,
  ctx: MerchantContext,
): Promise<MerchantProfile> {
  assertOwner(ctx);
  const row = await transitionMerchant(db, ctx.merchantId, "SUBMITTED", {
    rejectionReason: null,
    submittedAt: new Date(),
  });
  return toMerchantProfile(row);
}

export function toMerchantProfile(row: MerchantRow): MerchantProfile {
  return {
    businessAddress: row.businessAddress,
    complianceNotes: row.complianceNotes,
    complianceVerified: row.complianceVerifiedAt !== null,
    contactEmail: row.contactEmail,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    description: row.description,
    fssaiLicense: row.fssaiLicense,
    gstin: row.gstin,
    id: row.id,
    logoUrl: row.logoUrl,
    pan: row.pan,
    rejectionReason: row.rejectionReason,
    returnAddress: row.returnAddress,
    reviewedAt: row.reviewedAt,
    slug: row.slug,
    status: row.status,
    storeName: row.storeName,
    submittedAt: row.submittedAt,
  };
}

/**
 * Owner only. Fields locked for the shop's current status may be sent
 * unchanged (forms post every field) but not changed. Blank optional
 * fields are cleared.
 */
export async function updateMerchantProfile(
  db: Database,
  ctx: MerchantContext,
  patch: ProfilePatch,
): Promise<MerchantProfile> {
  assertOwner(ctx);
  const row = await loadMerchantRow(db, ctx.merchantId);
  if (row.status === "SUBMITTED") {
    throw new ConflictError(
      "under_review",
      "Your shop is under review and cannot be edited.",
    );
  }

  // Keys are ProfileFields whose values were validated by profilePatchSchema.
  const changes: Partial<Pick<MerchantRow, ProfileField>> = {};
  for (const [key, value] of Object.entries(patch) as [
    ProfileField,
    unknown,
  ][]) {
    if (value === undefined && !nullableFields.includes(key)) {
      continue;
    }
    const next = value ?? null;
    if (JSON.stringify(next) !== JSON.stringify(row[key])) {
      Object.assign(changes, { [key]: next });
    }
  }

  const locked = lockedFieldsFor(row.status);
  const lockedChanges = Object.keys(changes).filter((key) =>
    locked.has(key as ProfileField),
  );
  if (lockedChanges.length > 0) {
    throw new ConflictError(
      "field_locked",
      "Some fields are locked after approval. Contact Gillu to change them.",
      { fields: lockedChanges.sort() },
    );
  }
  if (Object.keys(changes).length === 0) {
    return toMerchantProfile(row);
  }

  try {
    const [updated] = await db
      .update(merchantsTable)
      .set(changes)
      .where(
        and(
          eq(merchantsTable.id, row.id),
          eq(merchantsTable.status, row.status),
        ),
      )
      .returning();
    if (!updated) {
      throw new ConflictError(
        "stale_profile",
        "Your shop changed while you were editing. Reload and try again.",
      );
    }
    return toMerchantProfile(updated);
  } catch (error) {
    if (uniqueViolation(error) === "merchants_slug_unique") {
      throw slugTaken();
    }
    throw error;
  }
}

function assertOwner(ctx: MerchantContext): void {
  if (!canManageProfile(ctx.role)) {
    throw new ForbiddenError("Only the shop owner can change the profile.");
  }
}
