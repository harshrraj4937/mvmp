import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq, sql } from "drizzle-orm";

import type { Database } from "~/db";
import type { MerchantContext } from "~/modules/merchants";

import {
  inventoryMovementsTable,
  inventoryTable,
  userTable,
} from "~/db/schema";
import { ConflictError } from "~/platform/errors";

import type { StockAdjustment } from "../presentation/schemas";

import {
  archivedProduct,
  loadOwnedVariant,
  loadVariantView,
  type VariantView,
} from "./shared";

export interface StockMovementView {
  actorName: null | string;
  availableAfter: number;
  createdAt: Date;
  delta: number;
  id: string;
  note: null | string;
  reason: string;
}

/**
 * Changes a variant's stock by `delta` and records the movement, in one
 * transaction. The guarded UPDATE never lets stock go below zero, even
 * under concurrent adjustments.
 */
export async function adjustStock(
  db: Database,
  ctx: MerchantContext,
  variantId: string,
  adjustment: StockAdjustment,
): Promise<VariantView> {
  const variant = await loadOwnedVariant(db, ctx, variantId);
  if (variant.productStatus === "ARCHIVED") {
    throw archivedProduct();
  }
  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(inventoryTable)
      .set({
        available: sql`${inventoryTable.available} + ${adjustment.delta}`,
      })
      .where(
        and(
          eq(inventoryTable.variantId, variantId),
          sql`${inventoryTable.available} + ${adjustment.delta} >= 0`,
        ),
      )
      .returning({ available: inventoryTable.available });
    if (!row) {
      throw new ConflictError(
        "insufficient_stock",
        "Not enough stock for that change.",
      );
    }
    await tx.insert(inventoryMovementsTable).values({
      actorUserId: ctx.userId,
      availableAfter: row.available,
      delta: adjustment.delta,
      id: createId(),
      note: adjustment.note ?? null,
      reason: adjustment.reason,
      variantId,
    });
  });
  return loadVariantView(db, variantId);
}

/** The variant's latest stock movements, newest first. */
export async function listStockMovements(
  db: Database,
  ctx: MerchantContext,
  variantId: string,
  limit = 20,
): Promise<StockMovementView[]> {
  await loadOwnedVariant(db, ctx, variantId);
  return db
    .select({
      actorName: userTable.name,
      availableAfter: inventoryMovementsTable.availableAfter,
      createdAt: inventoryMovementsTable.createdAt,
      delta: inventoryMovementsTable.delta,
      id: inventoryMovementsTable.id,
      note: inventoryMovementsTable.note,
      reason: inventoryMovementsTable.reason,
    })
    .from(inventoryMovementsTable)
    .leftJoin(userTable, eq(userTable.id, inventoryMovementsTable.actorUserId))
    .where(eq(inventoryMovementsTable.variantId, variantId))
    .orderBy(
      desc(inventoryMovementsTable.createdAt),
      desc(inventoryMovementsTable.id),
    )
    .limit(limit);
}
