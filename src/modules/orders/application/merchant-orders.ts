import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";

import type { Database } from "~/db";
import type { StateSlug } from "~/modules/catalog/domain/indian-states";
import type { MerchantContext } from "~/modules/merchants";

import {
  merchantOrdersTable,
  orderAddressSnapshotsTable,
  ordersTable,
  orderStatusHistoryTable,
} from "~/db/schema";
import { NotFoundError } from "~/platform/errors";

import type {
  ActorRole,
  FulfilmentStatus,
  MakerCancelReason,
  MerchantStep,
  PaymentMethod,
} from "../domain/statuses";
import type { MerchantCancelInput } from "../presentation/schemas";

import { applyTransition } from "./transition";
import {
  addressColumns,
  type AddressSnapshot,
  itemsByPart,
  type OrderItemView,
} from "./views";

export const MERCHANT_ORDERS_PAGE_SIZE = 25;

export interface MerchantOrderSummary {
  createdAt: string;
  id: string;
  itemCount: number;
  itemsSummary: string;
  number: string;
  paymentMethod: PaymentMethod;
  status: FulfilmentStatus;
  totalPaise: number;
}

export interface MerchantOrderView {
  address: AddressSnapshot;
  canceledBy: ActorRole | null;
  cancelNote: null | string;
  cancelReason: MakerCancelReason | null;
  codAmountPaise: null | number;
  createdAt: string;
  history: {
    actorRole: ActorRole;
    at: string;
    from: FulfilmentStatus | null;
    note: null | string;
    reason: null | string;
    to: FulfilmentStatus;
  }[];
  id: string;
  items: OrderItemView[];
  number: string;
  paymentMethod: PaymentMethod;
  status: FulfilmentStatus;
  totalPaise: number;
}

/** The maker's next step on their part (spec §4.2). */
export async function advanceMerchantOrder(
  db: Database,
  ctx: MerchantContext,
  id: string,
  to: MerchantStep,
): Promise<MerchantOrderView> {
  await ownPart(db, ctx, id);
  await db.transaction((tx) =>
    applyTransition(tx, id, to, { role: "MERCHANT", userId: ctx.userId }),
  );
  return getMerchantOrder(db, ctx, id);
}

/** The maker cancels their part with a reason the shopper sees. */
export async function cancelMerchantOrder(
  db: Database,
  ctx: MerchantContext,
  id: string,
  input: MerchantCancelInput,
): Promise<MerchantOrderView> {
  await ownPart(db, ctx, id);
  await db.transaction((tx) =>
    applyTransition(
      tx,
      id,
      "CANCELED",
      { role: "MERCHANT", userId: ctx.userId },
      { note: input.note, reason: input.reason },
    ),
  );
  return getMerchantOrder(db, ctx, id);
}

/** New parts, and parts being prepared or packed, for the desk. */
export async function countMerchantOrders(
  db: Database,
  merchantId: string,
): Promise<{ newOrders: number; toPack: number }> {
  const rows = await db
    .select({
      status: merchantOrdersTable.fulfilmentStatus,
      total: count(),
    })
    .from(merchantOrdersTable)
    .where(
      and(
        eq(merchantOrdersTable.merchantId, merchantId),
        inArray(merchantOrdersTable.fulfilmentStatus, [
          "NEW",
          "ACKNOWLEDGED",
          "PACKING",
        ]),
      ),
    )
    .groupBy(merchantOrdersTable.fulfilmentStatus);
  const of = (status: FulfilmentStatus) =>
    rows.find((row) => row.status === status)?.total ?? 0;
  return { newOrders: of("NEW"), toPack: of("ACKNOWLEDGED") + of("PACKING") };
}

export async function getMerchantOrder(
  db: Database,
  ctx: MerchantContext,
  id: string,
): Promise<MerchantOrderView> {
  await ownPart(db, ctx, id);
  const [part] = await db
    .select({
      address: addressColumns,
      canceledBy: merchantOrdersTable.canceledBy,
      cancelNote: merchantOrdersTable.cancelNote,
      cancelReason: merchantOrdersTable.cancelReason,
      codAmountPaise: merchantOrdersTable.codAmountPaise,
      createdAt: merchantOrdersTable.createdAt,
      id: merchantOrdersTable.id,
      number: merchantOrdersTable.number,
      paymentMethod: ordersTable.paymentMethod,
      status: merchantOrdersTable.fulfilmentStatus,
      totalPaise: merchantOrdersTable.totalPaise,
    })
    .from(merchantOrdersTable)
    .innerJoin(ordersTable, eq(ordersTable.id, merchantOrdersTable.orderId))
    .innerJoin(
      orderAddressSnapshotsTable,
      eq(orderAddressSnapshotsTable.orderId, ordersTable.id),
    )
    .where(eq(merchantOrdersTable.id, id));
  if (!part) {
    throw new NotFoundError("Order not found.");
  }
  const [items, history] = await Promise.all([
    itemsByPart(db, [id]),
    db
      .select({
        actorRole: orderStatusHistoryTable.actorRole,
        at: orderStatusHistoryTable.createdAt,
        from: orderStatusHistoryTable.fromStatus,
        note: orderStatusHistoryTable.note,
        reason: orderStatusHistoryTable.reason,
        to: orderStatusHistoryTable.toStatus,
      })
      .from(orderStatusHistoryTable)
      .where(eq(orderStatusHistoryTable.merchantOrderId, id))
      .orderBy(
        asc(orderStatusHistoryTable.createdAt),
        asc(orderStatusHistoryTable.id),
      ),
  ]);
  return {
    ...part,
    address: { ...part.address, state: part.address.state as StateSlug },
    createdAt: part.createdAt.toISOString(),
    history: history.map((row) => ({ ...row, at: row.at.toISOString() })),
    items: items.get(id) ?? [],
  };
}

/** The shop's parts, newest first, optionally of one status. */
export async function listMerchantOrders(
  db: Database,
  ctx: MerchantContext,
  { page, status }: { page: number; status?: FulfilmentStatus },
): Promise<{ items: MerchantOrderSummary[]; total: number }> {
  const where = and(
    eq(merchantOrdersTable.merchantId, ctx.merchantId),
    status ? eq(merchantOrdersTable.fulfilmentStatus, status) : undefined,
  );
  const [[{ total } = { total: 0 }], rows] = await Promise.all([
    db.select({ total: count() }).from(merchantOrdersTable).where(where),
    db
      .select({
        createdAt: merchantOrdersTable.createdAt,
        id: merchantOrdersTable.id,
        number: merchantOrdersTable.number,
        paymentMethod: ordersTable.paymentMethod,
        status: merchantOrdersTable.fulfilmentStatus,
        totalPaise: merchantOrdersTable.totalPaise,
      })
      .from(merchantOrdersTable)
      .innerJoin(ordersTable, eq(ordersTable.id, merchantOrdersTable.orderId))
      .where(where)
      .orderBy(
        desc(merchantOrdersTable.createdAt),
        desc(sql`${merchantOrdersTable.id}`),
      )
      .limit(MERCHANT_ORDERS_PAGE_SIZE)
      .offset((page - 1) * MERCHANT_ORDERS_PAGE_SIZE),
  ]);
  const items = await itemsByPart(
    db,
    rows.map((row) => row.id),
  );
  return {
    items: rows.map(({ createdAt, ...row }) => {
      const lines = items.get(row.id) ?? [];
      return {
        ...row,
        createdAt: createdAt.toISOString(),
        itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
        itemsSummary: lines
          .map((line) => `${line.productName} ×${line.quantity}`)
          .join(", "),
      };
    }),
    total,
  };
}

/** 404 unless the part belongs to the caller's shop. */
async function ownPart(
  db: Database,
  ctx: MerchantContext,
  id: string,
): Promise<void> {
  const [row] = await db
    .select({ id: merchantOrdersTable.id })
    .from(merchantOrdersTable)
    .where(
      and(
        eq(merchantOrdersTable.id, id),
        eq(merchantOrdersTable.merchantId, ctx.merchantId),
      ),
    );
  if (!row) {
    throw new NotFoundError("Order not found.");
  }
}
