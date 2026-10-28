"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Fired on `window` by client cart writes, with `detail: { count }`. */
export const CART_EVENT = "gillu:cart";

/** The header's cart link, with a badge once the cart has items. */
export function CartButton() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/v1/cart", { cache: "no-store" });
        const body = (await response.json()) as { data?: { count: number } };
        if (active && body.data) {
          setCount(body.data.count);
        }
      } catch {
        // The badge stays hidden when the cart cannot be read.
      }
    };
    void load();
    const onChange = (event: Event) => {
      setCount((event as CustomEvent<{ count: number }>).detail.count);
    };
    window.addEventListener(CART_EVENT, onChange);
    return () => {
      active = false;
      window.removeEventListener(CART_EVENT, onChange);
    };
  }, []);

  return (
    <Link className="cart-button" href="/cart">
      Cart
      {count > 0 && <span className="cart-count">{count}</span>}
    </Link>
  );
}
