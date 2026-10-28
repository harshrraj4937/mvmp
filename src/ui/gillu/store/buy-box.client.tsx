"use client";

import Link from "next/link";
import { useState } from "react";

import { sendJson } from "~/lib/api-client";

import { CART_EVENT } from "./cart-button.client";
import { formatRupees } from "./money";

const MAX_QUANTITY = 10;
const LOW_STOCK = 5;

export interface SizeOption {
  available: number;
  declaredMrpPaise: null | number;
  id: string;
  label: null | string;
  pricePaise: number;
}

/** Size, stock, quantity and add-to-cart for one product. */
export function BuyBox({ variants }: { variants: SizeOption[] }) {
  const firstInStock = variants.find((variant) => variant.available > 0);
  const [selectedId, setSelectedId] = useState(
    (firstInStock ?? variants[0])?.id ?? "",
  );
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");

  const selected = variants.find((variant) => variant.id === selectedId);
  if (!selected) {
    return null;
  }
  const max = Math.min(MAX_QUANTITY, selected.available);
  const soldOut = selected.available === 0;
  const showSizes = variants.length > 1 || variants[0]?.label;

  async function addToCart() {
    setBusy(true);
    setError("");
    setAdded(false);
    const result = await sendJson<{ count: number }>(
      "/api/v1/cart/items",
      "POST",
      { quantity, variantId: selected?.id },
    );
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    window.dispatchEvent(
      new CustomEvent(CART_EVENT, {
        detail: { count: result.data?.count ?? 0 },
      }),
    );
    setAdded(true);
  }

  return (
    <div className="buy-box">
      <p className="price">
        {formatRupees(selected.pricePaise)}
        {selected.declaredMrpPaise !== null &&
          selected.declaredMrpPaise > selected.pricePaise && (
            <s aria-label="MRP">{formatRupees(selected.declaredMrpPaise)}</s>
          )}
      </p>

      {showSizes && (
        <fieldset className="size-group">
          <legend>Choose a size</legend>
          {variants.map((variant) => {
            const text = variant.label ?? "Standard";
            return (
              <label className="size-option" key={variant.id}>
                <input
                  checked={variant.id === selectedId}
                  disabled={variant.available === 0}
                  name="size"
                  onChange={() => {
                    setSelectedId(variant.id);
                    setQuantity(1);
                  }}
                  type="radio"
                  value={variant.id}
                />
                {variant.available === 0 ? `${text} · Sold out` : text}
              </label>
            );
          })}
        </fieldset>
      )}

      {!soldOut && selected.available <= LOW_STOCK && (
        <p className="stock-note">Only {selected.available} left</p>
      )}

      <div className="quantity">
        <button
          aria-label="Decrease quantity"
          disabled={soldOut || quantity <= 1}
          onClick={() => {
            setQuantity((value) => Math.max(1, value - 1));
          }}
          type="button"
        >
          −
        </button>
        <input
          aria-label="Quantity"
          disabled={soldOut}
          id="quantity"
          max={max}
          min={1}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isInteger(next)) {
              setQuantity(Math.min(max, Math.max(1, next)));
            }
          }}
          type="number"
          value={quantity}
        />
        <button
          aria-label="Increase quantity"
          disabled={soldOut || quantity >= max}
          onClick={() => {
            setQuantity((value) => Math.min(max, value + 1));
          }}
          type="button"
        >
          +
        </button>
      </div>

      <button
        className="button add-to-cart"
        disabled={soldOut || busy}
        onClick={() => void addToCart()}
        type="button"
      >
        Add to cart
      </button>

      <p className="status-line" role="status">
        {added && (
          <>
            Added to cart · <Link href="/cart">View cart</Link>
          </>
        )}
      </p>
      {error && (
        <p className="notice danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
