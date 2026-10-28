import { createId } from "@paralleldrive/cuid2";
import { and, eq, gte, sql } from "drizzle-orm";

import {
  inventoryMovementsTable,
  inventoryTable,
  productsTable,
  productVariantsTable,
} from "~/db/schema";
import { ConflictError } from "~/platform/errors";

import type { Transaction } from "./shared";

/** One variant and how many pieces of it an order holds. */
export interface StockLine {
  quantity: number;
  variantId: string;
}

/** Ends a hold when the parcel leaves with the courier. */
export async function consumeStock(
  tx: Transaction,
  items: StockLine[],
): Promise<void> {
  for (const { quantity, variantId } of byVariant(items)) {
    await dropHold(tx, variantId, quantity, false);
  }
}

/**
 * Ends a hold on cancellation. `release` puts the pieces back on sale;
 * `write_off` drops them (the maker says they no longer exist).
 */
export async function releaseStock(
  tx: Transaction,
  items: StockLine[],
  mode: "release" | "write_off",
  actorUserId: null | string,
): Promise<void> {
  for (const { quantity, variantId } of byVariant(items)) {
    const row = await dropHold(tx, variantId, quantity, mode === "release");
    if (mode === "release") {
      await tx.insert(inventoryMovementsTable).values({
        actorUserId,
        availableAfter: row.available,
        delta: quantity,
        id: createId(),
        reason: "ORDER_RELEASED",
        variantId,
      });
    }
  }
}

/**
 * Holds stock for an order: moves each quantity from available to reserved,
 * all or nothing (the caller's transaction rolls back on the first shortfall).
 */
export async function reserveStock(
  tx: Transaction,
  items: StockLine[],
  actorUserId: null | string,
): Promise<void> {
  for (const { quantity, variantId } of byVariant(items)) {
    const [row] = await tx
      .update(inventoryTable)
      .set({
        available: sql`${inventoryTable.available} - ${quantity}`,
        reserved: sql`${inventoryTable.reserved} + ${quantity}`,
      })
      .where(
        and(
          eq(inventoryTable.variantId, variantId),
          gte(inventoryTable.available, quantity),
        ),
      )
      .returning({ available: inventoryTable.available });
    if (!row) {
      throw await shortOfStock(tx, variantId);
    }
    await tx.insert(inventoryMovementsTable).values({
      actorUserId,
      availableAfter: row.available,
      delta: -quantity,
      id: createId(),
      reason: "ORDER_RESERVED",
      variantId,
    });
  }
}

/**
 * Merges lines per variant and sorts by variant id, so concurrent orders take
 * row locks in the same order and cannot deadlock.
 */
function byVariant(items: StockLine[]): StockLine[] {
  const totals = new Map<string, number>();
  for (const { quantity, variantId } of items) {
    totals.set(variantId, (totals.get(variantId) ?? 0) + quantity);
  }
  return [...totals]
    .map(([variantId, quantity]) => ({ quantity, variantId }))
    .sort((a, b) => (a.variantId < b.variantId ? -1 : 1));
}

async function dropHold(
  tx: Transaction,
  variantId: string,
  quantity: number,
  backOnSale: boolean,
): Promise<{ available: number }> {
  const [row] = await tx
    .update(inventoryTable)
    .set({
      ...(backOnSale
        ? { available: sql`${inventoryTable.available} + ${quantity}` }
        : {}),
      reserved: sql`${inventoryTable.reserved} - ${quantity}`,
    })
    .where(
      and(
        eq(inventoryTable.variantId, variantId),
        gte(inventoryTable.reserved, quantity),
      ),
    )
    .returning({ available: inventoryTable.available });
  if (!row) {
    throw new Error(
      `Stock hold for variant ${variantId} is smaller than ${quantity}.`,
    );
  }
  return row;
}

async function shortOfStock(
  tx: Transaction,
  variantId: string,
): Promise<ConflictError> {
  const [row] = await tx
    .select({ available: inventoryTable.available, name: productsTable.name })
    .from(inventoryTable)
    .innerJoin(
      productVariantsTable,
      eq(productVariantsTable.id, inventoryTable.variantId),
    )
    .innerJoin(
      productsTable,
      eq(productsTable.id, productVariantsTable.productId),
    )
    .where(eq(inventoryTable.variantId, variantId));
  const available = row?.available ?? 0;
  const name = row?.name ?? "An item";
  return new ConflictError(
    "insufficient_stock",
    available === 0
      ? `${name} is sold out.`
      : `Only ${available} left of ${name}.`,
    { available, variantId },
  );
}
