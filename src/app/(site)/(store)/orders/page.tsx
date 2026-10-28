import type { Metadata } from "next";

import Link from "next/link";

import { db } from "~/db";
import { requireSession } from "~/modules/identity";
import { listShopperOrders } from "~/modules/orders";
import { formatRupees } from "~/ui/gillu/store/money";
import { OrderStatus } from "~/ui/gillu/store/order-status";

export const metadata: Metadata = {
  robots: { index: false },
  title: "My orders · Gillu",
};

export default async function OrdersPage() {
  const user = await requireSession("/orders");
  const orders = await listShopperOrders(db, user.id);

  return (
    <div className="checkout-page orders-page">
      <h1>My orders</h1>
      <p>
        <Link className="text-link" href="/account/addresses">
          Your addresses
        </Link>
      </p>
      {orders.length === 0 ? (
        <div className="cart-group">
          <p>No orders yet.</p>
          <Link className="button" href="/explore">
            Explore Gillu
          </Link>
        </div>
      ) : (
        <ul className="order-list">
          {orders.map((order) => (
            <li className="cart-group order-row" key={order.number}>
              <Link href={`/orders/${order.number}`}>{order.number}</Link>
              <span className="muted">
                {new Date(order.createdAt).toLocaleDateString("en-IN", {
                  dateStyle: "medium",
                  timeZone: "Asia/Kolkata",
                })}
              </span>
              <span className="order-row-statuses">
                {order.partStatuses.map((status, index) => (
                  // Parcels have no id here; their order never changes.
                  <OrderStatus key={index} status={status} />
                ))}
              </span>
              <strong>{formatRupees(order.totalPaise)}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
