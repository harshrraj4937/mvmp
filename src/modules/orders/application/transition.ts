import { createId } from "@paralleldrive/cuid2";
import { and, eq, inArray } from "drizzle-orm";

import type { Database } from "~/db";

import {
  inventoryReservationsTable,
  merchantOrdersTable,
  orderItemsTable,
  ordersTable,
  orderStatusHistoryTable,
} from "~/db/schema";
import {
  consumeStock,
  releaseStock,
} from "~/modules/catalog/application/reservations";
import { ConflictError, NotFoundError } from "~/platform/errors";

import type {
  ActorRole,
  FulfilmentStatus,
  MakerCancelReason,
} from "../domain/statuses";

import { deriveOrderStatus } from "../domain/derive";
import { canTransition, releaseMode } from "../domain/transitions";

export interface Actor {
  role: ActorRole;
  userId: null | string;
}

export interface CancelDetails {
  note?: string;
  reason: MakerCancelReason | null;
}

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export const invalidTransition = () =>
  new ConflictError(
    "invalid_transition",
    "This order can't move to that step.",
  );

/**
 * Moves one part to `to` inside the caller's transaction (spec §4.2): locks
 * the order then the part, refuses a step the actor may not take, moves held
 * stock on cancel or pickup, records history and re-derives the order status.
 */
export async function applyTransition(
  tx: Transaction,
  partId: string,
  to: FulfilmentStatus,
  actor: Actor,
  cancel?: CancelDetails,
): Promise<void> {
  const [ref] = await tx
    .select({ orderId: merchantOrdersTable.orderId })
    .from(merchantOrdersTable)
    .where(eq(merchantOrdersTable.id, partId));
  if (!ref) {
    throw new NotFoundError("Order not found.");
  }
  await tx
    .select({ id: ordersTable.id })
    .from(ordersTable)
    .where(eq(ordersTable.id, ref.orderId))
    .for("update");
  const [part] = await tx
    .select({ status: merchantOrdersTable.fulfilmentStatus })
    .from(merchantOrdersTable)
    .where(eq(merchantOrdersTable.id, partId))
    .for("update");
  if (!part || !canTransition(part.status, to, actor.role)) {
    throw invalidTransition();
  }

  if (to === "CANCELED") {
    const mode = releaseMode(actor.role, cancel?.reason ?? null);
    await settleHolds(
      tx,
      partId,
      mode === "release" ? "RELEASED" : "WRITTEN_OFF",
      (items) => releaseStock(tx, items, mode, actor.userId),
    );
  } else if (to === "HANDED_TO_COURIER") {
    await settleHolds(tx, partId, "CONSUMED", (items) =>
      consumeStock(tx, items),
    );
  }

  await tx
    .update(merchantOrdersTable)
    .set({
      fulfilmentStatus: to,
      ...(to === "CANCELED"
        ? {
            canceledAt: new Date(),
            canceledBy: actor.role,
            cancelNote: cancel?.note ?? null,
            cancelReason: cancel?.reason ?? null,
          }
        : {}),
    })
    .where(eq(merchantOrdersTable.id, partId));
  await tx.insert(orderStatusHistoryTable).values({
    actorRole: actor.role,
    actorUserId: actor.userId,
    fromStatus: part.status,
    id: createId(),
    merchantOrderId: partId,
    note: cancel?.note ?? null,
    reason: cancel?.reason ?? null,
    toStatus: to,
  });

  const parts = await tx
    .select({ status: merchantOrdersTable.fulfilmentStatus })
    .from(merchantOrdersTable)
    .where(eq(merchantOrdersTable.orderId, ref.orderId));
  await tx
    .update(ordersTable)
    .set({ status: deriveOrderStatus(parts.map((row) => row.status)) })
    .where(eq(ordersTable.id, ref.orderId));
}

/** Pickup and delivery: set by the shipping integration (Phase 7) and tests. */
export async function systemAdvance(
  db: Database,
  partId: string,
  to: "FULFILLED" | "HANDED_TO_COURIER",
): Promise<void> {
  await db.transaction((tx) =>
    applyTransition(tx, partId, to, { role: "SYSTEM", userId: null }),
  );
}

/** Ends the part's HELD reservations with `status`, moving the stock first. */
async function settleHolds(
  tx: Transaction,
  partId: string,
  status: "CONSUMED" | "RELEASED" | "WRITTEN_OFF",
  move: (items: { quantity: number; variantId: string }[]) => Promise<void>,
): Promise<void> {
  const holds = await tx
    .select({
      id: inventoryReservationsTable.id,
      quantity: inventoryReservationsTable.quantity,
      variantId: inventoryReservationsTable.variantId,
    })
    .from(inventoryReservationsTable)
    .innerJoin(
      orderItemsTable,
      eq(orderItemsTable.id, inventoryReservationsTable.orderItemId),
    )
    .where(
      and(
        eq(orderItemsTable.merchantOrderId, partId),
        eq(inventoryReservationsTable.status, "HELD"),
      ),
    );
  if (holds.length === 0) {
    return;
  }
  await move(holds);
  await tx
    .update(inventoryReservationsTable)
    .set({ status })
    .where(
      inArray(
        inventoryReservationsTable.id,
        holds.map((hold) => hold.id),
      ),
    );
}
