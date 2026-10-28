import { createId } from "@paralleldrive/cuid2";
import { and, eq, sql } from "drizzle-orm";

import type { Database } from "~/db";

import {
  inventoryReservationsTable,
  merchantOrdersTable,
  orderAddressSnapshotsTable,
  orderItemsTable,
  ordersTable,
  orderStatusHistoryTable,
} from "~/db/schema";
import {
  lockUserCart,
  removeCartLines,
} from "~/modules/cart/application/checkout-cart";
import { lineStatus } from "~/modules/cart/domain/line-status";
import { reserveStock } from "~/modules/catalog/application/reservations";
import {
  type CartVariantInfo,
  getVariantsForCart,
} from "~/modules/catalog/application/storefront";
import { uniqueViolation } from "~/platform/db-errors";
import { ConflictError } from "~/platform/errors";

import type { PlaceOrderInput } from "../presentation/schemas";

import { orderNumber, partNumber } from "../domain/numbers";
import { getAddress } from "./addresses";
import { type Executor, loadOrderView, type OrderView } from "./views";

interface PricedLine {
  info: CartVariantInfo;
  lineTotalPaise: number;
  quantity: number;
}

/**
 * Turns the shopper's cart into a cash-on-delivery order (spec §7): one order,
 * one part per maker, prices snapshotted, stock held, ordered lines removed
 * from the cart. A repeat with the same checkout key returns the first order.
 */
export async function placeOrder(
  db: Database,
  userId: string,
  input: PlaceOrderInput,
): Promise<{ created: boolean; order: OrderView }> {
  const existing = await orderIdForKey(db, userId, input.checkoutKey);
  if (existing) {
    return { created: false, order: await loadOrderView(db, existing) };
  }
  if (input.paymentMethod !== "COD") {
    throw new ConflictError(
      "payment_method_unavailable",
      "Online payment is coming soon. Choose cash on delivery.",
    );
  }
  try {
    return await db.transaction(async (tx) => {
      const cart = await lockUserCart(tx, userId);
      // A press that waited on the cart lock finds the order the first made.
      const placed = await orderIdForKey(tx, userId, input.checkoutKey);
      if (placed) {
        return { created: false, order: await loadOrderView(tx, placed) };
      }
      if (!cart || cart.lines.length === 0) {
        throw new ConflictError("cart_empty", "Your cart is empty.");
      }
      const infos = new Map(
        (
          await getVariantsForCart(
            tx,
            cart.lines.map((line) => line.variantId),
          )
        ).map((info) => [info.variantId, info]),
      );
      const lines: PricedLine[] = cart.lines.map((line) => {
        const info = infos.get(line.variantId);
        const status = info
          ? lineStatus({
              available: info.available,
              currentPricePaise: info.pricePaise,
              purchasable: info.purchasable,
              quantity: line.quantity,
              seenPricePaise: line.unitPricePaiseSeen,
            })
          : "unavailable";
        // Stock shortfalls are left to the reservation, which decides them
        // under the row lock and names the item.
        if (!info || status === "unavailable" || status === "price_changed") {
          throw new ConflictError(
            "cart_needs_attention",
            "Some items in your cart need attention.",
          );
        }
        return {
          info,
          lineTotalPaise: info.pricePaise * line.quantity,
          quantity: line.quantity,
        };
      });
      const address = await getAddress(tx, userId, input.addressId);
      const totalPaise = lines.reduce(
        (sum, line) => sum + line.lineTotalPaise,
        0,
      );
      if (totalPaise !== input.expectedTotalPaise) {
        throw new ConflictError(
          "price_changed",
          "Your total changed. Check your cart and try again.",
          { totalPaise },
        );
      }

      await reserveStock(
        tx,
        lines.map((line) => ({
          quantity: line.quantity,
          variantId: line.info.variantId,
        })),
        userId,
      );

      const number = orderNumber(await nextOrderNumber(tx));
      const orderId = createId();
      await tx.insert(ordersTable).values({
        checkoutKey: input.checkoutKey,
        id: orderId,
        itemsTotalPaise: totalPaise,
        number,
        paymentMethod: "COD",
        paymentStatus: "UNPAID",
        status: "CONFIRMED",
        totalPaise,
        userId,
      });
      await tx.insert(orderAddressSnapshotsTable).values({
        city: address.city,
        fullName: address.fullName,
        landmark: address.landmark,
        line1: address.line1,
        line2: address.line2,
        orderId,
        phone: address.phone,
        postalCode: address.postalCode,
        state: address.state,
      });

      const parts = groupByMaker(lines);
      for (const [index, partLines] of parts.entries()) {
        const partId = createId();
        const partTotal = partLines.reduce(
          (sum, line) => sum + line.lineTotalPaise,
          0,
        );
        await tx.insert(merchantOrdersTable).values({
          codAmountPaise: partTotal,
          id: partId,
          itemsTotalPaise: partTotal,
          merchantId: partLines[0]?.info.merchantId ?? "",
          number: partNumber(number, index),
          orderId,
          totalPaise: partTotal,
        });
        for (const line of partLines) {
          const itemId = createId();
          await tx.insert(orderItemsTable).values({
            coverImageUrl: line.info.coverImageUrl,
            declaredMrpPaise: line.info.declaredMrpPaise,
            id: itemId,
            lineTotalPaise: line.lineTotalPaise,
            merchantOrderId: partId,
            productId: line.info.productId,
            productName: line.info.productName,
            productSlug: line.info.productSlug,
            quantity: line.quantity,
            sku: line.info.sku,
            unitPricePaise: line.info.pricePaise,
            variantId: line.info.variantId,
            variantLabel: line.info.variantLabel,
          });
          await tx.insert(inventoryReservationsTable).values({
            id: createId(),
            orderItemId: itemId,
            quantity: line.quantity,
            variantId: line.info.variantId,
          });
        }
        await tx.insert(orderStatusHistoryTable).values({
          actorRole: "SHOPPER",
          actorUserId: userId,
          id: createId(),
          merchantOrderId: partId,
          toStatus: "NEW",
        });
      }

      await removeCartLines(
        tx,
        cart.cartId,
        lines.map((line) => line.info.variantId),
      );
      return { created: true, order: await loadOrderView(tx, orderId) };
    });
  } catch (error) {
    if (uniqueViolation(error) === "orders_user_checkout_key_unique") {
      const winner = await orderIdForKey(db, userId, input.checkoutKey);
      if (winner) {
        return { created: false, order: await loadOrderView(db, winner) };
      }
    }
    throw error;
  }
}

/** Lines grouped by maker, makers in the order they first appear. */
function groupByMaker(lines: PricedLine[]): PricedLine[][] {
  const groups = new Map<string, PricedLine[]>();
  for (const line of lines) {
    const key = line.info.merchantId;
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }
  return [...groups.values()];
}

async function nextOrderNumber(tx: Executor): Promise<number> {
  const [row] = await tx.execute<{ n: string }>(
    sql`select nextval('order_number_seq') as n`,
  );
  return Number(row?.n);
}

async function orderIdForKey(
  db: Executor,
  userId: string,
  checkoutKey: string,
): Promise<null | string> {
  const [row] = await db
    .select({ id: ordersTable.id })
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.userId, userId),
        eq(ordersTable.checkoutKey, checkoutKey),
      ),
    );
  return row?.id ?? null;
}
