"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type {
  FulfilmentStatus,
  MerchantStep,
} from "~/modules/orders/domain/statuses";

import { MAKER_CANCEL_TEXT } from "~/modules/orders/domain/labels";
import { MAKER_CANCEL_REASONS } from "~/modules/orders/domain/statuses";
import { isOpen } from "~/modules/orders/domain/transitions";

/** The maker's next step from each status, with its button. */
const NEXT: Partial<Record<FulfilmentStatus, [MerchantStep, string]>> = {
  ACKNOWLEDGED: ["PACKING", "Start packing"],
  NEW: ["ACKNOWLEDGED", "Start preparing"],
  PACKING: ["READY_FOR_PICKUP", "Mark packed"],
};

/** The next-step button and the cancel form for one part. */
export function MerchantOrderActions({
  id,
  status,
}: {
  id: string;
  status: FulfilmentStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState("");
  const locked = busy || refreshing;
  const next = NEXT[status];

  async function send(path: "cancel" | "status", body: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/v1/merchant/orders/${id}/${path}`, {
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        const json = (await response.json()) as {
          error?: { details?: Record<string, string[]>; message: string };
        };
        setMessage(
          json.error?.details?.note?.[0] ??
            json.error?.message ??
            "Something went wrong. Please try again.",
        );
        return;
      }
      setCancelling(false);
      startRefresh(() => {
        router.refresh();
      });
    } catch {
      setMessage("Could not reach Gillu. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!isOpen(status)) {
    return null;
  }

  return (
    <div className="order-actions">
      <div className="row">
        {next && (
          <button
            className="button primary"
            disabled={locked}
            onClick={() => send("status", { to: next[0] })}
            type="button"
          >
            {next[1]}
          </button>
        )}
        {!cancelling && (
          <button
            className="button"
            onClick={() => setCancelling(true)}
            type="button"
          >
            Cancel order
          </button>
        )}
      </div>
      {cancelling && (
        <form
          className="cancel-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void send("cancel", {
              note: form.get("note"),
              reason: form.get("reason"),
            });
          }}
        >
          <fieldset>
            <legend>Why are you cancelling? The shopper will see this.</legend>
            {MAKER_CANCEL_REASONS.map((reason) => (
              <label className="radio" key={reason}>
                <input name="reason" required type="radio" value={reason} />
                {MAKER_CANCEL_TEXT[reason]}
              </label>
            ))}
          </fieldset>
          <label className="field" htmlFor="cancelNote">
            Note for the shopper (needed for "Other")
          </label>
          <textarea id="cancelNote" maxLength={300} name="note" rows={3} />
          <div className="row">
            <button className="button danger" disabled={locked} type="submit">
              Cancel this order
            </button>
            <button
              className="button"
              onClick={() => setCancelling(false)}
              type="button"
            >
              Keep order
            </button>
          </div>
        </form>
      )}
      {message && (
        <p className="field-error" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
