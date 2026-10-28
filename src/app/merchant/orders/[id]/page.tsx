import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "~/db";
import { stateName } from "~/modules/catalog/domain/indian-states";
import { requireApprovedMerchant } from "~/modules/merchants";
import { getMerchantOrder, type MerchantOrderView } from "~/modules/orders";
import {
  MAKER_CANCEL_TEXT,
  MAKER_STATUS_TEXT,
} from "~/modules/orders/domain/labels";
import { NotFoundError } from "~/platform/errors";
import { MerchantOrderActions } from "~/ui/gillu/desk/merchant-order-actions.client";
import { OrderBadge } from "~/ui/gillu/desk/order-badge";
import { Panel } from "~/ui/gillu/desk/panel";
import { formatRupees } from "~/ui/gillu/store/money";

const ACTOR = { MERCHANT: "You", SHOPPER: "Shopper", SYSTEM: "Gillu" } as const;

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

export default async function MerchantOrderPage({
  params,
}: PageProps<"/merchant/orders/[id]">) {
  const { id } = await params;
  const merchant = await requireApprovedMerchant(`/merchant/orders/${id}`);
  let order: MerchantOrderView;
  try {
    order = await getMerchantOrder(db, merchant, id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }
  const { address } = order;
  const cancelled =
    order.status === "CANCELED"
      ? order.cancelReason
        ? MAKER_CANCEL_TEXT[order.cancelReason]
        : "by the shopper"
      : null;

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            <Link href="/merchant/orders">ORDERS</Link>
          </p>
          <h1>{order.number}</h1>
          <p>Placed {when(order.createdAt)}</p>
        </div>
      </div>
      <p className="order-status-line">
        <OrderBadge status={order.status} />
        {cancelled && (
          <span>
            Cancelled: {cancelled}
            {order.cancelNote ? ` — ${order.cancelNote}` : ""}
          </span>
        )}
      </p>
      <MerchantOrderActions id={order.id} status={order.status} />
      <div className="overview-grid">
        <Panel title="Items">
          <div className="table-scroll">
            <table className="orders-table merchant-orders-table">
              <thead>
                <tr>
                  <th>PRODUCT</th>
                  <th>SIZE</th>
                  <th>SKU</th>
                  <th>QTY</th>
                  <th>PRICE</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.sku}>
                    <td>{item.productName}</td>
                    <td>{item.variantLabel ?? "—"}</td>
                    <td>{item.sku}</td>
                    <td>{item.quantity}</td>
                    <td className="amount">
                      {formatRupees(item.unitPricePaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="order-total">
            Total <strong>{formatRupees(order.totalPaise)}</strong>
          </p>
          {order.paymentMethod === "COD" && order.status !== "CANCELED" && (
            <p>
              Cash on delivery: collect{" "}
              {formatRupees(order.codAmountPaise ?? order.totalPaise)}
            </p>
          )}
        </Panel>
        <Panel title="Deliver to">
          <address className="order-address">
            {address.fullName}
            <br />
            {address.phone}
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
            {address.city}, {stateName(address.state)}
            <br />
            PIN {address.postalCode}
          </address>
        </Panel>
      </div>
      <Panel title="History">
        <ol className="order-history">
          {order.history.map((row) => (
            <li key={`${row.at}-${row.to}`}>
              <strong>{MAKER_STATUS_TEXT[row.to]}</strong>{" "}
              <span className="muted">
                {ACTOR[row.actorRole]} · {when(row.at)}
              </span>
            </li>
          ))}
        </ol>
      </Panel>
    </>
  );
}
