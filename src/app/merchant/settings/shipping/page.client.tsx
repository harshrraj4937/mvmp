"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { PickupLocation } from "~/modules/merchants/application/pickup";

import { fieldErrors, sendJson } from "~/lib/api-client";
import { DeskBadge } from "~/ui/gillu/desk/badge";
import { PageHeading } from "~/ui/gillu/desk/page-heading";

import {
  AddressFields,
  emptyAddress,
  Field,
} from "../../merchant-fields.client";

const emptyLocation = {
  address: emptyAddress,
  contactName: "",
  label: "",
  phone: "",
};

export function ShippingSettings({
  locations,
}: {
  locations: PickupLocation[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(emptyLocation);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (request: () => ReturnType<typeof sendJson>) => {
    setBusy(true);
    setError("");
    const result = await request();
    setBusy(false);
    if (result.error) {
      setErrors(fieldErrors(result.error));
      setError(result.error.message);
      return false;
    }
    setErrors({});
    router.refresh();
    return true;
  };

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    const added = await run(() =>
      sendJson("/api/v1/merchant/pickup-locations", "POST", draft),
    );
    if (added) {
      setDraft(emptyLocation);
    }
  };

  return (
    <>
      <PageHeading
        subtitle="Couriers collect parcels from your primary location."
        title="Where your parcels begin."
      />
      <div className="settings-layout">
        <section className="panel settings-group">
          <h2>Pickup locations</h2>
          {locations.map((location) => (
            <div className="setting-row" key={location.id}>
              <span>
                <h3 className="row">
                  {location.label}
                  {location.isPrimary && (
                    <DeskBadge tone="delivered">Primary</DeskBadge>
                  )}
                </h3>
                <p>
                  {location.line1}
                  {location.line2 ? `, ${location.line2}` : ""}, {location.city}
                  , {location.state} {location.postalCode}
                </p>
                <p>
                  {location.contactName} · {location.phone}
                </p>
              </span>
              {!location.isPrimary && (
                <button
                  className="button small-button"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      sendJson(
                        `/api/v1/merchant/pickup-locations/${location.id}`,
                        "PATCH",
                        { isPrimary: true },
                      ),
                    )
                  }
                  type="button"
                >
                  Make primary
                </button>
              )}
            </div>
          ))}
          {error && (
            <p className="form-message error" role="alert">
              {error}
            </p>
          )}
        </section>
        <section className="panel settings-group">
          <h2>Add a pickup location</h2>
          <form noValidate onSubmit={add}>
            <div className="form-grid three">
              <Field
                error={errors.label}
                id="new-label"
                label="Label"
                onChange={(event) => {
                  setDraft({ ...draft, label: event.target.value });
                }}
                value={draft.label}
              />
              <Field
                error={errors.contactName}
                id="new-contactName"
                label="Contact name"
                onChange={(event) => {
                  setDraft({ ...draft, contactName: event.target.value });
                }}
                value={draft.contactName}
              />
              <Field
                error={errors.phone}
                id="new-phone"
                inputMode="tel"
                label="Contact mobile"
                onChange={(event) => {
                  setDraft({ ...draft, phone: event.target.value });
                }}
                value={draft.phone}
              />
            </div>
            <AddressFields
              error={errors.address}
              legend="Address"
              onChange={(address) => {
                setDraft({ ...draft, address });
              }}
              prefix="new"
              value={draft.address}
            />
            <div className="form-actions">
              <button className="button primary" disabled={busy} type="submit">
                Add location
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
