"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field } from "~/app/merchant/merchant-fields.client";
import { fieldErrors, sendJson } from "~/lib/api-client";

import { Modal } from "./modal.client";

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
    </Modal>
  );
}
