import type { Metadata } from "next";

import { cookies } from "next/headers";
import Link from "next/link";

import { db } from "~/db";
import { getCart, GUEST_CART_COOKIE, MAX_CART_LINES } from "~/modules/cart";
import { getSessionUser } from "~/modules/identity";
import { SiteIcon } from "~/ui/gillu/site/site-icons";
import { CartLines } from "~/ui/gillu/store/cart-lines.client";
import { CartSummary } from "~/ui/gillu/store/cart-summary";

export const metadata: Metadata = { title: "Your cart · Gillu" };

export default async function CartPage() {
  const user = await getSessionUser();
  const store = await cookies();
  const { view } = await getCart(db, {
    guestToken: store.get(GUEST_CART_COOKIE)?.value ?? null,
    userId: user?.id ?? null,
  });

  return (
    <div className="cart-page">
      <h1>Your cart</h1>
      {view.mergeDropped > 0 && (
        <p className="notice" role="status">
          {view.mergeDropped} {view.mergeDropped === 1 ? "item" : "items"} from
          your earlier cart did not fit ({MAX_CART_LINES} items max).
        </p>
      )}
      {view.groups.length === 0 ? (
        <section className="empty-state">
          <SiteIcon className="empty-icon" name="squirrel" />
          <p>Your cart is empty.</p>
          <Link className="text-link" href="/explore">
            Explore Gillu
          </Link>
        </section>
      ) : (
        <div className="cart-layout">
          <CartLines groups={view.groups} />
          <CartSummary
            canCheckout={view.canCheckout}
            count={view.count}
            totalPaise={view.totalPaise}
          />
        </div>
      )}
    </div>
  );
}
