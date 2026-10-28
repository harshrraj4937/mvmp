"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type {
  CartGroupView,
  CartLineView,
} from "~/modules/cart/application/cart";

import { CART_EVENT } from "./cart-button.client";
import { formatRupees } from "./money";

const MAX_QUANTITY = 10;
const PLACEHOLDER = "/gillu/basket.webp";

const STATUS_TEXT: Record<
  Exclude<CartLineView["status"], "ok" | "price_changed">,
  (line: CartLineView) => string
> = {
  short: (line) => `Only ${line.available} left — lower the quantity`,
  sold_out: () => "Sold out — remove it to continue",
  unavailable: () => "No longer available — remove it to continue",
};

/** The cart's shops and lines, editable. Every change goes through the cart API. */
export function CartLines({ groups }: { groups: CartGroupView[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [message, setMessage] = useState("");
  // Controls stay disabled until the refreshed lines arrive, so a second
  // click cannot compute its quantity from the stale ones.
  const locked = busy || refreshing;

  async function change(
    method: "DELETE" | "PATCH",
    variantId: string,
    body?: unknown,
  ) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/v1/cart/items/${variantId}`, {
        body: body === undefined ? undefined : JSON.stringify(body),
        headers:
          body === undefined
            ? undefined
            : { "content-type": "application/json" },
        method,
      });
      const json = (await response.json()) as {
        data?: { count: number };
        error?: { message: string };
      };
      if (!response.ok || json.error) {
        setMessage(
          json.error?.message ?? "Something went wrong. Please try again.",
        );
        return;
      }
      window.dispatchEvent(
        new CustomEvent(CART_EVENT, {
          detail: { count: json.data?.count ?? 0 },
        }),
      );
      startRefresh(() => {
        router.refresh();
      });
    } catch {
      setMessage("Could not reach Gillu. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cart-groups">
      {message && (
        <p className="notice danger" role="alert">
          {message}
        </p>
      )}
      {groups.map((group) => (
        <section className="cart-group" key={group.shopSlug}>
          <h2>
            {group.shopLinkable ? (
              <Link href={`/shops/${group.shopSlug}`}>{group.storeName}</Link>
            ) : (
              group.storeName
            )}
          </h2>
          <ul className="cart-lines">
            {group.lines.map((line) => {
              const name = line.productName;
              const cap = Math.min(MAX_QUANTITY, line.available);
              return (
                <li className="cart-line" key={line.variantId}>
                  <div className="cart-line-media">
                    <Image
                      alt=""
                      fill
                      sizes="96px"
                      src={line.coverImageUrl ?? PLACEHOLDER}
                      unoptimized
                    />
                  </div>
                  <div className="cart-line-body">
                    {line.productLinkable ? (
                      <Link
                        href={`/shops/${group.shopSlug}/${line.productSlug}`}
                      >
                        {name}
                      </Link>
                    ) : (
                      <span className="cart-name">{name}</span>
                    )}
                    {line.variantLabel && (
                      <p className="small muted">{line.variantLabel}</p>
                    )}
                    <p className="small">
                      {formatRupees(line.unitPricePaise)} each
                    </p>
                    {line.status === "price_changed" && (
                      <p className="line-status">
                        Price changed from {formatRupees(line.seenPricePaise)}{" "}
                        to {formatRupees(line.unitPricePaise)}{" "}
                        <button
                          className="text-button small"
                          disabled={locked}
                          onClick={() =>
                            void change("PATCH", line.variantId, {
                              acknowledgePrice: true,
                            })
                          }
                          type="button"
                        >
                          OK
                        </button>
                      </p>
                    )}
                    {line.status !== "ok" &&
                      line.status !== "price_changed" && (
                        <p className="line-status">
                          {STATUS_TEXT[line.status](line)}
                        </p>
                      )}
                    <div className="line-actions">
                      <div className="quantity">
                        <button
                          aria-label={`Decrease quantity of ${name}`}
                          disabled={locked || line.quantity <= 1}
                          onClick={() =>
                            void change("PATCH", line.variantId, {
                              quantity: line.quantity - 1,
                            })
                          }
                          type="button"
                        >
                          −
                        </button>
                        <span aria-live="polite">{line.quantity}</span>
                        <button
                          aria-label={`Increase quantity of ${name}`}
                          disabled={locked || line.quantity >= cap}
                          onClick={() =>
                            void change("PATCH", line.variantId, {
                              quantity: line.quantity + 1,
                            })
                          }
                          type="button"
                        >
                          +
                        </button>
                      </div>
                      <button
                        aria-label={`Remove ${name}`}
                        className="text-button small"
                        disabled={locked}
                        onClick={() => void change("DELETE", line.variantId)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="cart-subtotal">
            Subtotal {formatRupees(group.subtotalPaise)}
          </p>
        </section>
      ))}
    </div>
  );
}
