"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import type { CartGroupView } from "~/modules/cart/application/cart";
import type { AddressView } from "~/modules/orders/application/addresses";

import { stateName } from "~/modules/catalog/domain/indian-states";

import { AddressForm } from "./address-form.client";
import { CART_EVENT } from "./cart-button.client";
import { CheckoutLines } from "./cart-summary";
import { formatRupees } from "./money";

/** Errors the shopper fixes in the cart, not here. */
const CART_ERRORS = new Set([
  "cart_empty",
  "cart_needs_attention",
  "insufficient_stock",
  "price_changed",
]);

/**
 * Checkout (spec §7): the parcels, a delivery address, the payment method and
 * "Place order". The checkout key stays the same for the page's life, so a
 * repeated press returns the same order.
 */
export function CheckoutForm({
  addresses: initialAddresses,
  checkoutKey,
  groups,
  needsAttention,
  totalPaise,
}: {
  addresses: AddressView[];
  checkoutKey: string;
  groups: CartGroupView[];
  needsAttention: boolean;
  totalPaise: number;
}) {
  const router = useRouter();
  const [key] = useState(checkoutKey);
  const [addresses, setAddresses] = useState(initialAddresses);
  const [addressId, setAddressId] = useState(initialAddresses[0]?.id ?? "");
  const [adding, setAdding] = useState(initialAddresses.length === 0);
  const [error, setError] = useState<null | { code: string; message: string }>(
    null,
  );
  const [sending, setSending] = useState(false);
  // State updates land after a double click's second event; this does not.
  const inFlight = useRef(false);

  async function placeOrder() {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/orders", {
        body: JSON.stringify({
          addressId,
          checkoutKey: key,
          expectedTotalPaise: totalPaise,
          paymentMethod: "COD",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const json = (await response.json()) as {
        data?: { number: string };
        error?: { code: string; message: string };
      };
      if (!response.ok || !json.data) {
        setError(
          json.error ?? {
            code: "unknown",
            message: "Something went wrong. Please try again.",
          },
        );
        inFlight.current = false;
        setSending(false);
        return;
      }
      window.dispatchEvent(
        new CustomEvent(CART_EVENT, { detail: { count: 0 } }),
      );
      router.push(`/orders/${json.data.number}?placed=1`);
    } catch {
      setError({
        code: "network",
        message: "Could not reach Gillu. Check your connection and try again.",
      });
      inFlight.current = false;
      setSending(false);
    }
  }

  const canPlace = !needsAttention && addressId !== "" && !adding && !sending;

  return (
    <div className="checkout-layout">
      <div className="checkout-steps">
        <section aria-labelledby="checkout-items" className="checkout-section">
          <h2 id="checkout-items">Your items</h2>
          {needsAttention && (
            <p className="notice danger" role="alert">
              Some items need attention. <Link href="/cart">Back to cart</Link>
            </p>
          )}
          <CheckoutLines groups={groups} />
        </section>

        <section
          aria-labelledby="checkout-address"
          className="checkout-section"
        >
          <h2 id="checkout-address">Deliver to</h2>
          {addresses.length > 0 && (
            <fieldset className="choices">
              <legend className="sr-only">Delivery address</legend>
              {addresses.map((address) => (
                <label className="choice" key={address.id}>
                  <input
                    checked={address.id === addressId}
                    name="address"
                    onChange={() => setAddressId(address.id)}
                    type="radio"
                    value={address.id}
                  />
                  <span>
                    <strong>{address.fullName}</strong>, {address.line1},{" "}
                    {address.city}, {stateName(address.state)}{" "}
                    {address.postalCode}
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {adding ? (
            <AddressForm
              onCancel={
                addresses.length > 0 ? () => setAdding(false) : undefined
              }
              onSaved={(saved) => {
                setAddresses((list) => [
                  saved,
                  ...list.map((address) =>
                    saved.isDefault
                      ? { ...address, isDefault: false }
                      : address,
                  ),
                ]);
                setAddressId(saved.id);
                setAdding(false);
              }}
            />
          ) : (
            <button
              className="text-button"
              onClick={() => setAdding(true)}
              type="button"
            >
              Add a new address
            </button>
          )}
        </section>

        <section
          aria-labelledby="checkout-payment"
          className="checkout-section"
        >
          <h2 id="checkout-payment">Payment</h2>
          <fieldset className="choices">
            <legend className="sr-only">Payment method</legend>
            <label className="choice">
              <input checked name="payment" readOnly type="radio" value="COD" />
              <span>Cash on delivery</span>
            </label>
            <label className="choice disabled">
              <input disabled name="payment" type="radio" value="PREPAID" />
              <span>
                Pay online <span className="coming-soon">Coming soon</span>
              </span>
            </label>
          </fieldset>
          {groups.length > 1 && (
            <p className="small">
              Your order comes in {groups.length} parcels. Pay each one when it
              arrives: {parcelAmounts(groups)}.
            </p>
          )}
        </section>
      </div>

      <aside aria-label="Order summary" className="cart-summary">
        <dl className="checkout-summary">
          <div>
            <dt>Items</dt>
            <dd>{formatRupees(totalPaise)}</dd>
          </div>
          <div>
            <dt>Delivery</dt>
            <dd>Free</dd>
          </div>
          <div className="cart-total">
            <dt>Total</dt>
            <dd>
              <strong>{formatRupees(totalPaise)}</strong>
            </dd>
          </div>
        </dl>
        <button
          className="button"
          disabled={!canPlace}
          onClick={placeOrder}
          type="button"
        >
          Place order
        </button>
        {error && (
          <p className="field-error" role="alert">
            {error.message}{" "}
            {CART_ERRORS.has(error.code) && (
              <Link href="/cart">Back to cart</Link>
            )}
          </p>
        )}
      </aside>
    </div>
  );
}

/** "₹349 to Goa Kitchen, ₹500 to Jaipur Clay" */
function parcelAmounts(groups: CartGroupView[]): string {
  return groups
    .map(
      (group) => `${formatRupees(group.subtotalPaise)} to ${group.storeName}`,
    )
    .join(", ");
}
