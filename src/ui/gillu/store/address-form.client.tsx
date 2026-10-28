"use client";

import { useState } from "react";

import type { AddressView } from "~/modules/orders/application/addresses";

import { INDIAN_STATES } from "~/modules/catalog/domain/indian-states";

const FIELDS = [
  ["fullName", "Full name", "name"],
  ["phone", "Mobile number", "tel"],
  ["line1", "Address line 1", "address-line1"],
  ["line2", "Address line 2 (optional)", "address-line2"],
  ["landmark", "Landmark (optional)", "off"],
  ["city", "City", "address-level2"],
] as const;

type FieldName = "postalCode" | "state" | (typeof FIELDS)[number][0];

/**
 * A delivery address form (India only). Saves a new address, or changes
 * `address` when given; field errors show under each field.
 */
export function AddressForm({
  address,
  onCancel,
  onSaved,
}: {
  address?: AddressView;
  onCancel?: () => void;
  onSaved: (address: AddressView) => void;
}) {
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      ...Object.fromEntries(
        [...form.entries()].filter(([key]) => key !== "isDefault"),
      ),
      isDefault: form.get("isDefault") === "on",
    };
    setSaving(true);
    setErrors({});
    setMessage("");
    try {
      const response = await fetch(
        address
          ? `/api/v1/account/addresses/${address.id}`
          : "/api/v1/account/addresses",
        {
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
          method: address ? "PATCH" : "POST",
        },
      );
      const json = (await response.json()) as {
        data?: AddressView;
        error?: { details?: Record<string, string[]>; message: string };
      };
      if (!response.ok || !json.data) {
        const details = json.error?.details ?? {};
        setErrors(
          Object.fromEntries(
            Object.entries(details).map(([key, list]) => [key, list[0]]),
          ),
        );
        if (Object.keys(details).length === 0) {
          setMessage(
            json.error?.message ?? "Something went wrong. Please try again.",
          );
        }
        return;
      }
      onSaved(json.data);
    } catch {
      setMessage("Could not reach Gillu. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const describedBy = (name: FieldName) =>
    errors[name] ? `${name}-error` : undefined;
  const error = (name: FieldName) =>
    errors[name] && (
      <p className="field-error" id={`${name}-error`}>
        {errors[name]}
      </p>
    );

  return (
    <form className="address-form" noValidate onSubmit={submit}>
      {FIELDS.map(([name, label, autoComplete]) => (
        <div className="field" key={name}>
          <label htmlFor={name}>{label}</label>
          <input
            aria-describedby={describedBy(name)}
            aria-invalid={errors[name] ? true : undefined}
            autoComplete={autoComplete}
            defaultValue={address?.[name] ?? ""}
            id={name}
            inputMode={name === "phone" ? "tel" : undefined}
            name={name}
          />
          {error(name)}
        </div>
      ))}
      <div className="field-row">
        <div className="field">
          <label htmlFor="state">State</label>
          <select
            aria-describedby={describedBy("state")}
            aria-invalid={errors.state ? true : undefined}
            defaultValue={address?.state ?? ""}
            id="state"
            name="state"
          >
            <option disabled value="">
              Choose a state
            </option>
            {INDIAN_STATES.map((state) => (
              <option key={state.slug} value={state.slug}>
                {state.name}
              </option>
            ))}
          </select>
          {error("state")}
        </div>
        <div className="field">
          <label htmlFor="postalCode">PIN code</label>
          <input
            aria-describedby={describedBy("postalCode")}
            aria-invalid={errors.postalCode ? true : undefined}
            autoComplete="postal-code"
            defaultValue={address?.postalCode ?? ""}
            id="postalCode"
            inputMode="numeric"
            name="postalCode"
          />
          {error("postalCode")}
        </div>
      </div>
      {!address?.isDefault && (
        <label className="check">
          <input name="isDefault" type="checkbox" />
          Make this my default address
        </label>
      )}
      {message && (
        <p className="field-error" role="alert">
          {message}
        </p>
      )}
      <div className="form-actions">
        <button className="button" disabled={saving} type="submit">
          Save address
        </button>
        {onCancel && (
          <button className="text-button" onClick={onCancel} type="button">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
