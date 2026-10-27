import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq, sql } from "drizzle-orm";

import type { Database } from "~/db";

import { merchantPickupLocationsTable } from "~/db/schema";
import { uniqueViolation } from "~/platform/db-errors";
import { ConflictError, NotFoundError } from "~/platform/errors";

import type {
  PickupLocationInput,
  PickupLocationPatch,
} from "../presentation/schemas";
import type { MerchantContext } from "./membership";

export interface PickupLocation {
  city: string;
  contactName: string;
  id: string;
  isPrimary: boolean;
  label: string;
  line1: string;
  line2: null | string;
  phone: string;
  postalCode: string;
  state: string;
}

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Owner or staff. The first location is always primary. */
export async function addPickupLocation(
  db: Database,
  ctx: MerchantContext,
  input: PickupLocationInput & { isPrimary?: boolean },
): Promise<PickupLocation> {
  return withPrimaryConflict(() =>
    db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: merchantPickupLocationsTable.id })
        .from(merchantPickupLocationsTable)
        .where(eq(merchantPickupLocationsTable.merchantId, ctx.merchantId))
        .limit(1);
      const isPrimary = !existing || input.isPrimary === true;
      if (isPrimary) {
        await clearPrimary(tx, ctx.merchantId);
      }
      const [row] = await tx
        .insert(merchantPickupLocationsTable)
        .values({
          ...input.address,
          contactName: input.contactName,
          id: createId(),
          isPrimary,
          label: input.label,
          merchantId: ctx.merchantId,
          phone: input.phone,
        })
        .returning();
      if (!row) {
        throw new Error("Insert returned no pickup location");
      }
      return toPickupLocation(row);
    }),
  );
}

/** The merchant's pickup locations, primary first. */
export async function listPickupLocations(
  db: Database,
  ctx: MerchantContext,
): Promise<PickupLocation[]> {
  const rows = await db
    .select()
    .from(merchantPickupLocationsTable)
    .where(eq(merchantPickupLocationsTable.merchantId, ctx.merchantId))
    .orderBy(
      sql`${merchantPickupLocationsTable.isPrimary} desc`,
      asc(merchantPickupLocationsTable.createdAt),
    );
  return rows.map(toPickupLocation);
}

export function toPickupLocation(
  row: typeof merchantPickupLocationsTable.$inferSelect,
): PickupLocation {
  const {
    city,
    contactName,
    id,
    isPrimary,
    label,
    line1,
    line2,
    phone,
    postalCode,
    state,
  } = row;
  return {
    city,
    contactName,
    id,
    isPrimary,
    label,
    line1,
    line2,
    phone,
    postalCode,
    state,
  };
}

/**
 * Owner or staff. A location of another merchant is "not found": the
 * query is always scoped to the caller's merchant.
 */
export async function updatePickupLocation(
  db: Database,
  ctx: MerchantContext,
  locationId: string,
  patch: PickupLocationPatch,
): Promise<PickupLocation> {
  return withPrimaryConflict(() =>
    db.transaction(async (tx) => {
      const ownLocation = and(
        eq(merchantPickupLocationsTable.id, locationId),
        eq(merchantPickupLocationsTable.merchantId, ctx.merchantId),
      );
      const [current] = await tx
        .select()
        .from(merchantPickupLocationsTable)
        .where(ownLocation)
        .for("update");
      if (!current) {
        throw new NotFoundError("Pickup location not found.");
      }
      if (patch.isPrimary === false && current.isPrimary) {
        throw new ConflictError(
          "primary_required",
          "Choose another primary pickup location first.",
        );
      }
      if (patch.isPrimary === true && !current.isPrimary) {
        await clearPrimary(tx, ctx.merchantId);
      }

      const { address, isPrimary, ...fields } = patch;
      const [row] = await tx
        .update(merchantPickupLocationsTable)
        .set({
          ...fields,
          ...address,
          isPrimary: isPrimary ?? current.isPrimary,
        })
        .where(ownLocation)
        .returning();
      if (!row) {
        throw new NotFoundError("Pickup location not found.");
      }
      return toPickupLocation(row);
    }),
  );
}

async function clearPrimary(tx: Transaction, merchantId: string) {
  await tx
    .update(merchantPickupLocationsTable)
    .set({ isPrimary: false })
    .where(
      and(
        eq(merchantPickupLocationsTable.merchantId, merchantId),
        eq(merchantPickupLocationsTable.isPrimary, true),
      ),
    );
}

async function withPrimaryConflict<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (uniqueViolation(error) === "merchant_pickup_locations_one_primary") {
      throw new ConflictError(
        "primary_changed",
        "Another change to your pickup locations was saved. Reload and try again.",
      );
    }
    throw error;
  }
}
