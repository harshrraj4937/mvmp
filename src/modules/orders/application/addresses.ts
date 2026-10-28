import { createId } from "@paralleldrive/cuid2";
import { and, count, desc, eq, ne } from "drizzle-orm";

import type { Database } from "~/db";
import type { StateSlug } from "~/modules/catalog/domain/indian-states";

import { customerAddressesTable, userTable } from "~/db/schema";
import { ConflictError, NotFoundError } from "~/platform/errors";

import type { AddressInput, AddressPatch } from "../presentation/schemas";

export const MAX_ADDRESSES = 10;

export interface AddressView {
  city: string;
  fullName: string;
  id: string;
  isDefault: boolean;
  landmark: null | string;
  line1: string;
  line2: null | string;
  phone: string;
  postalCode: string;
  state: StateSlug;
}

/** A database handle or an open transaction. */
export type Executor = Database | Transaction;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

const columns = {
  city: customerAddressesTable.city,
  fullName: customerAddressesTable.fullName,
  id: customerAddressesTable.id,
  isDefault: customerAddressesTable.isDefault,
  landmark: customerAddressesTable.landmark,
  line1: customerAddressesTable.line1,
  line2: customerAddressesTable.line2,
  phone: customerAddressesTable.phone,
  postalCode: customerAddressesTable.postalCode,
  state: customerAddressesTable.state,
};

const toView = (row: Omit<AddressView, "state"> & { state: string }) =>
  ({ ...row, state: row.state as StateSlug }) satisfies AddressView;

export async function createAddress(
  db: Database,
  userId: string,
  input: AddressInput,
): Promise<AddressView> {
  return db.transaction(async (tx) => {
    await lockShopper(tx, userId);
    const [{ total } = { total: 0 }] = await tx
      .select({ total: count() })
      .from(customerAddressesTable)
      .where(eq(customerAddressesTable.userId, userId));
    if (total >= MAX_ADDRESSES) {
      throw new ConflictError(
        "address_limit",
        `You can save up to ${MAX_ADDRESSES} addresses.`,
      );
    }
    const isDefault = total === 0 || input.isDefault === true;
    if (isDefault) {
      await clearDefault(tx, userId);
    }
    const [row] = await tx
      .insert(customerAddressesTable)
      .values({
        city: input.city,
        fullName: input.fullName,
        id: createId(),
        isDefault,
        landmark: input.landmark ?? null,
        line1: input.line1,
        line2: input.line2 ?? null,
        phone: input.phone,
        postalCode: input.postalCode,
        state: input.state,
        userId,
      })
      .returning(columns);
    if (!row) {
      throw new Error("Address insert returned no row.");
    }
    return toView(row);
  });
}

export async function deleteAddress(
  db: Database,
  userId: string,
  id: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await lockShopper(tx, userId);
    const address = await getAddress(tx, userId, id);
    await tx
      .delete(customerAddressesTable)
      .where(eq(customerAddressesTable.id, id));
    if (!address.isDefault) {
      return;
    }
    const [newest] = await tx
      .select({ id: customerAddressesTable.id })
      .from(customerAddressesTable)
      .where(eq(customerAddressesTable.userId, userId))
      .orderBy(desc(customerAddressesTable.createdAt))
      .limit(1);
    if (newest) {
      await tx
        .update(customerAddressesTable)
        .set({ isDefault: true })
        .where(eq(customerAddressesTable.id, newest.id));
    }
  });
}

/** The shopper's own address; anyone else's is not found. */
export async function getAddress(
  db: Executor,
  userId: string,
  id: string,
): Promise<AddressView> {
  const [row] = await db
    .select(columns)
    .from(customerAddressesTable)
    .where(
      and(
        eq(customerAddressesTable.id, id),
        eq(customerAddressesTable.userId, userId),
      ),
    );
  if (!row) {
    throw new NotFoundError("Address not found.");
  }
  return toView(row);
}

/** Default first, then newest first. */
export async function listAddresses(
  db: Database,
  userId: string,
): Promise<AddressView[]> {
  const rows = await db
    .select(columns)
    .from(customerAddressesTable)
    .where(eq(customerAddressesTable.userId, userId))
    .orderBy(
      desc(customerAddressesTable.isDefault),
      desc(customerAddressesTable.createdAt),
    );
  return rows.map(toView);
}

/**
 * Changes an address. `isDefault: true` makes it the default; the default
 * only moves that way, so `isDefault: false` never leaves a shopper without
 * one.
 */
export async function updateAddress(
  db: Database,
  userId: string,
  id: string,
  patch: AddressPatch,
): Promise<AddressView> {
  return db.transaction(async (tx) => {
    await lockShopper(tx, userId);
    await getAddress(tx, userId, id);
    if (patch.isDefault === true) {
      await clearDefault(tx, userId, id);
    }
    await tx
      .update(customerAddressesTable)
      .set({
        ...changedFields(patch),
        ...(patch.isDefault === true ? { isDefault: true } : {}),
      })
      .where(eq(customerAddressesTable.id, id));
    return getAddress(tx, userId, id);
  });
}

/**
 * The fields a patch names. An optional field sent blank is cleared; a field
 * left out stays as it is.
 */
function changedFields(patch: AddressPatch) {
  const set: Partial<typeof customerAddressesTable.$inferInsert> = {};
  for (const key of [
    "city",
    "fullName",
    "line1",
    "phone",
    "postalCode",
    "state",
  ] as const) {
    if (patch[key] !== undefined) {
      set[key] = patch[key];
    }
  }
  if ("landmark" in patch) {
    set.landmark = patch.landmark ?? null;
  }
  if ("line2" in patch) {
    set.line2 = patch.line2 ?? null;
  }
  return set;
}

async function clearDefault(tx: Transaction, userId: string, except?: string) {
  await tx
    .update(customerAddressesTable)
    .set({ isDefault: false })
    .where(
      and(
        eq(customerAddressesTable.userId, userId),
        eq(customerAddressesTable.isDefault, true),
        ...(except ? [ne(customerAddressesTable.id, except)] : []),
      ),
    );
}

/** Serialises one shopper's address changes (count and default rules). */
async function lockShopper(tx: Transaction, userId: string) {
  await tx
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .for("update");
}
