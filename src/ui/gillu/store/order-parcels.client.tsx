"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { OrderView, PartView } from "~/modules/orders/application/views";

import { MAKER_CANCEL_TEXT } from "~/modules/orders/domain/labels";
import { isOpen } from "~/modules/orders/domain/transitions";

import { formatRupees } from "./money";
import { OrderStatus } from "./order-status";

/** The order's parcels, each with its maker, items, status and cancel. */
export function OrderParcels({ order }: { order: OrderView }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<null | string>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [message, setMessage] = useState("");
  const open = order.parts.filter((part) => isOpen(part.status));

  async function cancel(merchantOrder?: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/v1/orders/${order.number}/cancel`, {
        body: JSON.stringify(merchantOrder ? { merchantOrder } : {}),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        const json = (await response.json()) as {
          error?: { message: string };
        };
        setMessage(
          json.error?.message ?? "Something went wrong. Please try again.",
        );
        return;
      }
      setConfirming(null);
      startRefresh(() => {
        router.refresh();
      });
    } catch {
      setMessage("Could not reach Gillu. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const confirm = (target: string, merchantOrder?: string) =>
    confirming === target ? (
      <span className="confirm">
        <span>Cancel {merchantOrder ? "this parcel" : "the whole order"}?</span>
        <button
          className="text-button"
          disabled={busy || refreshing}
          onClick={() => cancel(merchantOrder)}
          type="button"
        >
          Yes, cancel
        </button>
        <button
          className="text-button"
          onClick={() => setConfirming(null)}
          type="button"
        >
          Keep it
        </button>
      </span>
    ) : null;

  return (
    <div className="order-parcels">
      {order.parts.map((part, index) => {
        const headingId = `parcel-${part.number}`;
        const cancelled = cancelText(part);
        return (
          <section
            aria-labelledby={headingId}
            className="cart-group order-parcel"
            key={part.id}
          >
            <div className="parcel-head">
              <h2 id={headingId}>
                Parcel {index + 1} of {order.parts.length} ·{" "}
                {part.shopLinkable ? (
                  <Link href={`/shops/${part.shopSlug}`}>{part.storeName}</Link>
                ) : (
                  part.storeName
                )}
              </h2>
              <OrderStatus status={part.status} />
            </div>
            <p className="small muted">{part.number}</p>
            <ul className="cart-lines">
              {part.items.map((item) => (
                <li
                  className="checkout-line"
                  key={`${item.sku}-${item.productSlug}`}
                >
                  <span>
                    {item.productName}
                    {item.variantLabel ? ` · ${item.variantLabel}` : ""}
                  </span>
                  <span>
                    {item.quantity} × {formatRupees(item.unitPricePaise)}
                  </span>
                </li>
              ))}
            </ul>
            {cancelled ? (
              <p className="small">{cancelled}</p>
            ) : (
              order.paymentMethod === "COD" &&
              part.status !== "FULFILLED" && (
                <p className="cart-subtotal">
                  Pay {formatRupees(part.codAmountPaise ?? part.totalPaise)} on
                  delivery
                </p>
              )
            )}
            {isOpen(part.status) &&
              (confirm(part.number, part.number) ?? (
                <button
                  className="text-button"
                  onClick={() => setConfirming(part.number)}
                  type="button"
                >
                  Cancel this parcel
                </button>
              ))}
          </section>
        );
      })}
      {open.length >= 2 &&
        (confirm("all") ?? (
          <button
            className="text-button"
            onClick={() => setConfirming("all")}
            type="button"
          >
            Cancel order
          </button>
        ))}
      {message && (
        <p className="field-error" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}

/** Who cancelled a parcel, and why, in the shopper's words. */
function cancelText(part: PartView): null | string {
  if (part.status !== "CANCELED") {
    return null;
  }
  if (part.canceledBy === "SHOPPER") {
    return "You cancelled this parcel.";
  }
  const reason = part.cancelReason ? MAKER_CANCEL_TEXT[part.cancelReason] : "";
  return `Cancelled by ${part.storeName}: ${reason}${part.cancelNote ? ` — ${part.cancelNote}` : ""}`;
}
