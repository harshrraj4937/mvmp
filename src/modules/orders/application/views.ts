import { asc, eq, inArray } from "drizzle-orm";

import type { Database } from "~/db";
import type { StateSlug } from "~/modules/catalog/domain/indian-states";

import {
  merchantOrdersTable,
  merchantsTable,
  orderAddressSnapshotsTable,
  orderItemsTable,
  ordersTable,
} from "~/db/schema";
import { linkableShopIds } from "~/modules/catalog/application/storefront";
import { NotFoundError } from "~/platform/errors";

import type {
  ActorRole,
  FulfilmentStatus,
  MakerCancelReason,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "../domain/statuses";

export interface AddressSnapshot {
  city: string;
  fullName: string;
  landmark: null | string;
  line1: string;
  line2: null | string;
  phone: string;
  postalCode: string;
  state: StateSlug;
}
export type Executor = Database | Transaction;

export interface OrderItemView {
  coverImageUrl: null | string;
  declaredMrpPaise: null | number;
  lineTotalPaise: number;
  productName: string;
  productSlug: string;
  quantity: number;
  sku: string;
  unitPricePaise: number;
  variantLabel: null | string;
}

export interface OrderView {
  address: AddressSnapshot;
  createdAt: string;
  deliveryPaise: number;
  itemsTotalPaise: number;
  number: string;
  parts: PartView[];
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  totalPaise: number;
}

export interface PartView {
  canceledBy: ActorRole | null;
  cancelNote: null | string;
  cancelReason: MakerCancelReason | null;
  codAmountPaise: null | number;
  id: string;
  items: OrderItemView[];
  number: string;
  shopLinkable: boolean;
  shopSlug: string;
  status: FulfilmentStatus;
  storeName: string;
  totalPaise: number;
}

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export const itemColumns = {
  coverImageUrl: orderItemsTable.coverImageUrl,
  declaredMrpPaise: orderItemsTable.declaredMrpPaise,
  lineTotalPaise: orderItemsTable.lineTotalPaise,
  productName: orderItemsTable.productName,
  productSlug: orderItemsTable.productSlug,
  quantity: orderItemsTable.quantity,
  sku: orderItemsTable.sku,
  unitPricePaise: orderItemsTable.unitPricePaise,
  variantLabel: orderItemsTable.variantLabel,
};

export const addressColumns = {
  city: orderAddressSnapshotsTable.city,
  fullName: orderAddressSnapshotsTable.fullName,
  landmark: orderAddressSnapshotsTable.landmark,
  line1: orderAddressSnapshotsTable.line1,
  line2: orderAddressSnapshotsTable.line2,
  phone: orderAddressSnapshotsTable.phone,
  postalCode: orderAddressSnapshotsTable.postalCode,
  state: orderAddressSnapshotsTable.state,
};

/** Items of the given parts, grouped by part, in the order they were added. */
export async function itemsByPart(
  db: Executor,
  partIds: string[],
): Promise<Map<string, OrderItemView[]>> {
  const grouped = new Map<string, OrderItemView[]>();
  if (partIds.length === 0) {
    return grouped;
  }
  const rows = await db
    .select({ ...itemColumns, partId: orderItemsTable.merchantOrderId })
    .from(orderItemsTable)
    .where(inArray(orderItemsTable.merchantOrderId, partIds))
    .orderBy(asc(orderItemsTable.createdAt), asc(orderItemsTable.id));
  for (const { partId, ...item } of rows) {
    grouped.set(partId, [...(grouped.get(partId) ?? []), item]);
  }
  return grouped;
}

/** The whole order as the shopper sees it. */
export async function loadOrderView(
  db: Executor,
  orderId: string,
): Promise<OrderView> {
  const [order] = await db
    .select({
      address: addressColumns,
      createdAt: ordersTable.createdAt,
      deliveryPaise: ordersTable.deliveryPaise,
      itemsTotalPaise: ordersTable.itemsTotalPaise,
      number: ordersTable.number,
      paymentMethod: ordersTable.paymentMethod,
      paymentStatus: ordersTable.paymentStatus,
      status: ordersTable.status,
      totalPaise: ordersTable.totalPaise,
    })
    .from(ordersTable)
    .innerJoin(
      orderAddressSnapshotsTable,
      eq(orderAddressSnapshotsTable.orderId, ordersTable.id),
    )
    .where(eq(ordersTable.id, orderId));
  if (!order) {
    throw new NotFoundError("Order not found.");
  }
  const parts = await db
    .select({
      canceledBy: merchantOrdersTable.canceledBy,
      cancelNote: merchantOrdersTable.cancelNote,
      cancelReason: merchantOrdersTable.cancelReason,
      codAmountPaise: merchantOrdersTable.codAmountPaise,
      id: merchantOrdersTable.id,
      merchantId: merchantOrdersTable.merchantId,
      number: merchantOrdersTable.number,
      shopSlug: merchantsTable.slug,
      status: merchantOrdersTable.fulfilmentStatus,
      storeName: merchantsTable.storeName,
      totalPaise: merchantOrdersTable.totalPaise,
    })
    .from(merchantOrdersTable)
    .innerJoin(
      merchantsTable,
      eq(merchantsTable.id, merchantOrdersTable.merchantId),
    )
    .where(eq(merchantOrdersTable.orderId, orderId))
    .orderBy(asc(merchantOrdersTable.number));
  const [items, linkable] = await Promise.all([
    itemsByPart(
      db,
      parts.map((part) => part.id),
    ),
    linkableShopIds(
      db,
      parts.map((part) => part.merchantId),
    ),
  ]);
  return {
    ...order,
    address: { ...order.address, state: order.address.state as StateSlug },
    createdAt: order.createdAt.toISOString(),
    parts: parts.map(({ merchantId, ...part }) => ({
      ...part,
      items: items.get(part.id) ?? [],
      shopLinkable: linkable.has(merchantId),
    })),
  };
}
