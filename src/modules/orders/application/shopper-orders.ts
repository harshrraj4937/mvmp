import { and, asc, desc, eq, inArray } from "drizzle-orm";

import type { Database } from "~/db";

import { merchantOrdersTable, ordersTable } from "~/db/schema";
import { NotFoundError } from "~/platform/errors";

import type { FulfilmentStatus, OrderStatus } from "../domain/statuses";
import type { ShopperCancelInput } from "../presentation/schemas";

import { isOpen } from "../domain/transitions";
import { applyTransition, invalidTransition } from "./transition";
import { type Executor, loadOrderView, type OrderView } from "./views";

export interface OrderSummary {
  createdAt: string;
  number: string;
  partStatuses: FulfilmentStatus[];
  status: OrderStatus;
  totalPaise: number;
}

/**
 * Cancels one parcel (by its number) or every parcel not yet delivered or
 * cancelled. Held stock goes back on sale.
 */
export async function cancelShopperOrder(
  db: Database,
  userId: string,
  number: string,
  input: ShopperCancelInput,
): Promise<OrderView> {
  const orderId = await ownOrderId(db, userId, number);
  await db.transaction(async (tx) => {
    await tx
      .select({ id: ordersTable.id })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .for("update");
    const parts = await tx
      .select({
        id: merchantOrdersTable.id,
        number: merchantOrdersTable.number,
        status: merchantOrdersTable.fulfilmentStatus,
      })
      .from(merchantOrdersTable)
      .where(eq(merchantOrdersTable.orderId, orderId))
      .orderBy(asc(merchantOrdersTable.number));
    const targets = input.merchantOrder
      ? parts.filter((part) => part.number === input.merchantOrder)
      : parts.filter((part) => isOpen(part.status));
    if (input.merchantOrder && targets.length === 0) {
      throw new NotFoundError("Parcel not found.");
    }
    if (targets.length === 0) {
      throw invalidTransition();
    }
    for (const part of targets) {
      await applyTransition(
        tx,
        part.id,
        "CANCELED",
        { role: "SHOPPER", userId },
        { note: input.reason, reason: null },
      );
    }
  });
  return loadOrderView(db, orderId);
}

export async function getShopperOrder(
  db: Database,
  userId: string,
  number: string,
): Promise<OrderView> {
  return loadOrderView(db, await ownOrderId(db, userId, number));
}

/** The shopper's orders, newest first. */
export async function listShopperOrders(
  db: Database,
  userId: string,
): Promise<OrderSummary[]> {
  const orders = await db
    .select({
      createdAt: ordersTable.createdAt,
      id: ordersTable.id,
      number: ordersTable.number,
      status: ordersTable.status,
      totalPaise: ordersTable.totalPaise,
    })
    .from(ordersTable)
    .where(eq(ordersTable.userId, userId))
    .orderBy(desc(ordersTable.createdAt));
  if (orders.length === 0) {
    return [];
  }
  const parts = await db
    .select({
      orderId: merchantOrdersTable.orderId,
      status: merchantOrdersTable.fulfilmentStatus,
    })
    .from(merchantOrdersTable)
    .where(
      inArray(
        merchantOrdersTable.orderId,
        orders.map((order) => order.id),
      ),
    )
    .orderBy(asc(merchantOrdersTable.number));
  return orders.map(({ createdAt, id, ...order }) => ({
    ...order,
    createdAt: createdAt.toISOString(),
    partStatuses: parts
      .filter((part) => part.orderId === id)
      .map((part) => part.status),
  }));
}

/** The order's id when it belongs to `userId`; anyone else's is not found. */
async function ownOrderId(
  db: Executor,
  userId: string,
  number: string,
): Promise<string> {
  const [row] = await db
    .select({ id: ordersTable.id })
    .from(ordersTable)
    .where(and(eq(ordersTable.number, number), eq(ordersTable.userId, userId)));
  if (!row) {
    throw new NotFoundError("Order not found.");
  }
  return row.id;
}
