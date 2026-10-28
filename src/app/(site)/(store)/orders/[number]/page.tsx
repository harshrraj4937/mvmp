import type { Metadata } from "next";

import { notFound } from "next/navigation";

import { db } from "~/db";
import { stateName } from "~/modules/catalog/domain/indian-states";
import { requireSession } from "~/modules/identity";
import { getShopperOrder, type OrderView } from "~/modules/orders";
import { NotFoundError } from "~/platform/errors";
import { formatRupees } from "~/ui/gillu/store/money";
import { OrderParcels } from "~/ui/gillu/store/order-parcels.client";

export const metadata: Metadata = {
  robots: { index: false },
  title: "Your order · Gillu",
};

export default async function OrderPage({
  params,
  searchParams,
}: PageProps<"/orders/[number]">) {
  const { number } = await params;
  const user = await requireSession(`/orders/${number}`);
  let order: OrderView;
  try {
    order = await getShopperOrder(db, user.id, number);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }
  const placed = (await searchParams).placed === "1";
  const { address } = order;

  return (
    <div className="checkout-page orders-page">
      <h1>
        {placed
          ? `Thank you — your order ${order.number} is placed.`
          : `Order ${order.number}`}
      </h1>
      <p className="muted">
        Placed{" "}
        {new Date(order.createdAt).toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Asia/Kolkata",
        })}
      </p>
      <div className="checkout-layout">
        <OrderParcels order={order} />
        <aside aria-label="Order details" className="cart-summary">
          <h2 className="summary-heading">Deliver to</h2>
          <address className="order-address">
            {address.fullName}
            <br />
            {address.line1}
            {address.line2 ? (
              <>
                <br />
                {address.line2}
              </>
            ) : null}
            {address.landmark ? (
              <>
                <br />
                Near {address.landmark}
              </>
            ) : null}
            <br />
            {address.city}, {stateName(address.state)} {address.postalCode}
            <br />
            {address.phone}
          </address>
          <p>Payment: Cash on delivery</p>
          <dl className="checkout-summary">
            <div>
              <dt>Items</dt>
              <dd>{formatRupees(order.itemsTotalPaise)}</dd>
            </div>
            <div>
              <dt>Delivery</dt>
              <dd>Free</dd>
            </div>
            <div className="cart-total">
              <dt>Total</dt>
              <dd>
                <strong>{formatRupees(order.totalPaise)}</strong>
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
