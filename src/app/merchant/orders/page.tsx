import Link from "next/link";

import type { FulfilmentStatus } from "~/modules/orders/domain/statuses";

import { db } from "~/db";
import { requireApprovedMerchant } from "~/modules/merchants";
import {
  listMerchantOrders,
  MERCHANT_ORDERS_PAGE_SIZE,
  merchantOrderListQuerySchema,
} from "~/modules/orders";
import { EmptyState } from "~/ui/gillu/desk/empty-state";
import { OrderBadge } from "~/ui/gillu/desk/order-badge";
import { PageHeading } from "~/ui/gillu/desk/page-heading";
import { formatRupees } from "~/ui/gillu/store/money";

const TABS: [string, FulfilmentStatus | undefined][] = [
  ["New", "NEW"],
  ["Preparing", "ACKNOWLEDGED"],
  ["Packing", "PACKING"],
  ["Packed", "READY_FOR_PICKUP"],
  ["Cancelled", "CANCELED"],
  ["All", undefined],
];

const tabHref = (status?: FulfilmentStatus, page = 1) => {
  const params = new URLSearchParams();
  if (status) {
    params.set("status", status);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const query = params.toString();
  return query ? `/merchant/orders?${query}` : "/merchant/orders";
};

export default async function MerchantOrdersPage({
  searchParams,
}: PageProps<"/merchant/orders">) {
  const merchant = await requireApprovedMerchant("/merchant/orders");
  // Unknown or repeated parameters are ignored rather than shown as errors.
  const parsed = merchantOrderListQuerySchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : { page: 1 };
  const { items, total } = await listMerchantOrders(db, merchant, query);
  const pages = Math.max(1, Math.ceil(total / MERCHANT_ORDERS_PAGE_SIZE));

  return (
    <>
      <PageHeading
        eyebrow="YOUR ORDERS"
        subtitle="Start preparing new orders, pack them, and they are ready for pickup."
        title="Orders"
      />
      <nav aria-label="Order status" className="order-tabs">
        {TABS.map(([label, status]) => (
          <Link
            aria-current={query.status === status ? "page" : undefined}
            className={
              query.status === status ? "order-tab active" : "order-tab"
            }
            href={tabHref(status)}
            key={label}
          >
            {label}
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <EmptyState
          body="Orders from shoppers appear here as soon as they are placed."
          icon="bag"
          title="No orders here yet."
        />
      ) : (
        <div className="table-scroll">
          <table className="orders-table merchant-orders-table">
            <thead>
              <tr>
                <th>ORDER</th>
                <th>PLACED</th>
                <th>ITEMS</th>
                <th>TOTAL</th>
                <th>PAYMENT</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {items.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link href={`/merchant/orders/${order.id}`}>
                      {order.number}
                    </Link>
                  </td>
                  <td>
                    {new Date(order.createdAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Asia/Kolkata",
                    })}
                  </td>
                  <td>{order.itemsSummary}</td>
                  <td className="amount">{formatRupees(order.totalPaise)}</td>
                  <td>
                    {order.paymentMethod === "COD"
                      ? "Cash on delivery"
                      : "Paid online"}
                  </td>
                  <td>
                    <OrderBadge status={order.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav aria-label="Pages" className="pager">
          {query.page > 1 && (
            <Link href={tabHref(query.status, query.page - 1)}>Previous</Link>
          )}
          <span>
            Page {query.page} of {pages}
          </span>
          {query.page < pages && (
            <Link href={tabHref(query.status, query.page + 1)}>Next</Link>
          )}
        </nav>
      )}
    </>
  );
}
