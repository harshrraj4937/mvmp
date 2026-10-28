import type { Metadata } from "next";

import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "~/db";
import { getCart, GUEST_CART_COOKIE } from "~/modules/cart";
import { requireSession } from "~/modules/identity";
import { CheckoutLines } from "~/ui/gillu/store/cart-summary";
import { formatRupees } from "~/ui/gillu/store/money";

export const metadata: Metadata = {
  robots: { index: false },
  title: "Checkout · Gillu",
};

export default async function CheckoutPage() {
  const user = await requireSession("/checkout");
  const store = await cookies();
  const { view } = await getCart(db, {
    guestToken: store.get(GUEST_CART_COOKIE)?.value ?? null,
    userId: user.id,
  });
  if (view.groups.length === 0) {
    redirect("/cart");
  }
  const needsAttention = view.groups.some((group) =>
    group.lines.some((line) => line.status !== "ok"),
  );

  return (
    <div className="checkout-page">
      <h1>Checkout</h1>
      {needsAttention && (
        <p className="notice danger" role="alert">
          Some items need attention. <Link href="/cart">Back to cart</Link>
        </p>
      )}
      <CheckoutLines groups={view.groups} />
      <p className="cart-total">
        Total <strong>{formatRupees(view.totalPaise)}</strong>
      </p>
      <button className="button" disabled type="button">
        Place order
      </button>
      <p className="small muted">Ordering opens soon — your cart is saved.</p>
    </div>
  );
}
