"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Field } from "~/app/merchant/merchant-fields.client";
import { fieldErrors, sendJson } from "~/lib/api-client";

import { Modal } from "./modal.client";

const REASON_LABELS: Record<string, string> = {
  CORRECTION: "Count correction",
  DAMAGED: "Damaged or expired",
  INITIAL: "Opening stock",
  ORDER_RELEASED: "Order cancelled",
  ORDER_RESERVED: "Held for an order",
  OTHER: "Something else",
  RESTOCK: "New stock arrived",
};

interface Movement {
  actorName: null | string;
  availableAfter: number;
  createdAt: string;
  delta: number;
  id: string;
  note: null | string;
  reason: string;
}

const REASONS = [
  ["RESTOCK", "New stock arrived"],
  ["DAMAGED", "Damaged or expired"],
  ["CORRECTION", "Count correction"],
  ["OTHER", "Something else"],
] as const;

/** Adds or removes stock for one variant, with a reason. */
export function StockDialog({
  onClose,
  variant,
}: {
  onClose: () => void;
  variant: null | { available: number; id: string; name: string };
}) {
  const router = useRouter();
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState<string>("RESTOCK");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [movements, setMovements] = useState<Movement[] | null>(null);
  const variantId = variant?.id;

  useEffect(() => {
    if (!variantId) {
      return;
    }
    let current = true;
    setMovements(null);
    void fetch(`/api/v1/merchant/variants/${variantId}/stock-movements`)
      .then((response) => response.json() as Promise<{ data?: Movement[] }>)
      .then((body) => {
        if (current) {
          setMovements(body.data ?? []);
        }
      })
      .catch(() => {
        if (current) {
          setMovements([]);
        }
      });
    return () => {
      current = false;
    };
  }, [variantId]);

  function close() {
    setDelta("");
    setNote("");
    setErrors({});
    setMessage("");
    onClose();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!variant) {
      return;
    }
    setSaving(true);
    const result = await sendJson(
      `/api/v1/merchant/variants/${variant.id}/stock-adjustments`,
      "POST",
      { delta, note, reason },
    );
    setSaving(false);
    if (result.error) {
      const next = fieldErrors(result.error);
      setErrors(next);
      setMessage(Object.keys(next).length > 0 ? "" : result.error.message);
      return;
    }
    close();
    router.refresh();
  }

  return (
    <Modal
      onClose={close}
      open={variant !== null}
      subtitle={
        variant
          ? `${variant.name}: ${variant.available} in stock now.`
          : undefined
      }
      title="Adjust stock"
    >
      <form noValidate onSubmit={submit}>
        <div className="form-grid">
          <Field
            error={errors.delta}
            hint="Use a minus sign to remove stock, like -2."
            id="delta"
            inputMode="numeric"
            label="Change in stock"
            onChange={(event) => setDelta(event.target.value)}
            required
            value={delta}
          />
          <div className="field">
            <label htmlFor="reason">Reason</label>
            <select
              id="reason"
              onChange={(event) => setReason(event.target.value)}
              value={reason}
            >
              {REASONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="full">
            <Field
              error={errors.note}
              id="note"
              label="Note (optional)"
              maxLength={200}
              onChange={(event) => setNote(event.target.value)}
              value={note}
            />
          </div>
        </div>
        {message && (
          <p className="notice danger" role="alert">
            {message}
          </p>
        )}
        <div className="form-actions">
          <button className="button primary" disabled={saving} type="submit">
            Save adjustment
          </button>
        </div>
      </form>
      <h3 className="movements-title" id="movements-title">
        Recent stock changes
      </h3>
      {movements === null ? (
        <p className="small muted">Loading…</p>
      ) : movements.length === 0 ? (
        <p className="small muted">No changes yet.</p>
      ) : (
        <ul aria-labelledby="movements-title" className="movements">
          {movements.map((movement) => (
            <li key={movement.id}>
              <strong>
                {movement.delta > 0 ? `+${movement.delta}` : movement.delta}
              </strong>{" "}
              {REASON_LABELS[movement.reason] ?? movement.reason}
              {movement.note ? ` · ${movement.note}` : ""}
              <span className="small muted">
                {" "}
                → {movement.availableAfter} ·{" "}
                {new Date(movement.createdAt).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
                {movement.actorName ? ` · ${movement.actorName}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
