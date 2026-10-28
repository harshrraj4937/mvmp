import Link from "next/link";

import type { CartGroupView } from "~/modules/cart/application/cart";

import { formatRupees } from "./money";

/** The cart's total, and the way on to checkout (disabled until every line is fine). */
export function CartSummary({
  canCheckout,
  count,
  totalPaise,
}: {
  canCheckout: boolean;
  count: number;
  totalPaise: number;
}) {
  return (
    <aside aria-label="Order summary" className="cart-summary">
      <p>
        {count} {count === 1 ? "item" : "items"}
      </p>
      <p className="cart-total">
        Total <strong>{formatRupees(totalPaise)}</strong>
      </p>
      {canCheckout ? (
        <Link className="button" href="/checkout">
          Checkout
        </Link>
      ) : (
        <>
          <button className="button" disabled type="button">
            Checkout
          </button>
          <p className="small muted">Fix the items marked above to continue.</p>
        </>
      )}
    </aside>
  );
}

/** The cart's lines as text, one parcel per shop, for checkout. */
export function CheckoutLines({ groups }: { groups: CartGroupView[] }) {
  return (
    <div className="cart-groups">
      {groups.map((group, index) => (
        <section className="cart-group" key={group.shopSlug}>
          <h3>
            Parcel {index + 1} of {groups.length} · {group.storeName}
          </h3>
          <ul className="cart-lines">
            {group.lines.map((line) => (
              <li className="checkout-line" key={line.variantId}>
                <span>
                  {line.productName}
                  {line.variantLabel ? ` · ${line.variantLabel}` : ""}
                </span>
                <span>
                  {line.quantity} × {formatRupees(line.unitPricePaise)}
                </span>
              </li>
            ))}
          </ul>
          <p className="cart-subtotal">
            Subtotal {formatRupees(group.subtotalPaise)}
          </p>
        </section>
      ))}
    </div>
  );
}
