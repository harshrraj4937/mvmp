import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";

import type { Database } from "~/db";

import {
  merchantMembersTable,
  merchantPickupLocationsTable,
  merchantsTable,
} from "~/db/schema";
import { uniqueViolation } from "~/platform/db-errors";
import { ConflictError } from "~/platform/errors";

import type { OnboardingInput } from "../presentation/schemas";
import type { MerchantContext } from "./membership";

const alreadyOwner = () =>
  new ConflictError("already_merchant_owner", "You already have a shop.");

export const slugTaken = () =>
  new ConflictError("slug_taken", "That shop URL is already taken.");

/**
 * Creates a DRAFT merchant owned by `user`, with its primary pickup
 * location, in one transaction.
 */
export async function registerMerchant(
  db: Database,
  user: { id: string },
  input: OnboardingInput,
): Promise<MerchantContext> {
  if (await ownsMerchant(db, user.id)) {
    throw alreadyOwner();
  }

  const merchantId = createId();
  const { pickup, ...profile } = input;
  try {
    await db.transaction(async (tx) => {
      await tx.insert(merchantsTable).values({ ...profile, id: merchantId });
      // A concurrent registration by the same user fails here on
      // merchant_members_one_owned_per_user and rolls everything back.
      await tx.insert(merchantMembersTable).values({
        id: createId(),
        merchantId,
        role: "owner",
        userId: user.id,
      });
      await tx.insert(merchantPickupLocationsTable).values({
        ...pickup.address,
        contactName: pickup.contactName,
        id: createId(),
        isPrimary: true,
        label: pickup.label,
        merchantId,
        phone: pickup.phone,
      });
    });
  } catch (error) {
    const constraint = uniqueViolation(error);
    if (constraint === "merchants_slug_unique") {
      // A double submit carries the same slug, so the second request
      // trips the slug index before the one-owner index: report the
      // real reason when the slug went to this user's own new shop.
      throw (await ownsMerchant(db, user.id)) ? alreadyOwner() : slugTaken();
    }
    if (constraint === "merchant_members_one_owned_per_user") {
      throw alreadyOwner();
    }
    throw error;
  }

  return {
    merchantId,
    role: "owner",
    slug: input.slug,
    status: "DRAFT",
    storeName: input.storeName,
    userId: user.id,
  };
}

async function ownsMerchant(db: Database, userId: string): Promise<boolean> {
  const [owned] = await db
    .select({ id: merchantMembersTable.id })
    .from(merchantMembersTable)
    .where(
      and(
        eq(merchantMembersTable.userId, userId),
        eq(merchantMembersTable.role, "owner"),
      ),
    )
    .limit(1);
  return owned !== undefined;
}
