import type { Metadata } from "next";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "~/db";
import { getCart, GUEST_CART_COOKIE } from "~/modules/cart";
import { requireSession } from "~/modules/identity";
import { listAddresses } from "~/modules/orders";
import { CheckoutForm } from "~/ui/gillu/store/checkout-form.client";

export const metadata: Metadata = {
  robots: { index: false },
  title: "Checkout · Gillu",
};

export default async function CheckoutPage() {
  const user = await requireSession("/checkout");
  const store = await cookies();
  const [{ view }, addresses] = await Promise.all([
    getCart(db, {
      guestToken: store.get(GUEST_CART_COOKIE)?.value ?? null,
      userId: user.id,
    }),
    listAddresses(db, user.id),
  ]);
  if (view.groups.length === 0) {
    redirect("/cart");
  }
  const needsAttention = view.groups.some((group) =>
    group.lines.some((line) => line.status !== "ok"),
  );

  return (
    <div className="checkout-page">
      <h1>Checkout</h1>
      <CheckoutForm
        addresses={addresses}
        checkoutKey={crypto.randomUUID()}
        groups={view.groups}
        needsAttention={needsAttention}
        totalPaise={view.totalPaise}
      />
    </div>
  );
}
