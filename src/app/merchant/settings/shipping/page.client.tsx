"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { PickupLocation } from "~/modules/merchants/application/pickup";

import { fieldErrors, sendJson } from "~/lib/api-client";
import { Badge } from "~/ui/primitives/badge";
import { Button } from "~/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/primitives/card";

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
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Pickup locations</CardTitle>
          <CardDescription>
            Couriers collect parcels from your primary location.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {locations.map((location) => (
            <div
              className={`
                flex flex-wrap items-start justify-between gap-3 rounded-md
                border p-4
              `}
              key={location.id}
            >
              <div className="grid gap-1 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  {location.label}
                  {location.isPrimary && <Badge>Primary</Badge>}
                </div>
                <span>
                  {location.line1}
                  {location.line2 ? `, ${location.line2}` : ""}, {location.city}
                  , {location.state} {location.postalCode}
                </span>
                <span className="text-muted-foreground">
                  {location.contactName} · {location.phone}
                </span>
              </div>
              {!location.isPrimary && (
                <Button
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
                  size="sm"
                  variant="outline"
                >
                  Make primary
                </Button>
              )}
            </div>
          ))}
          {error && (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add a pickup location</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" noValidate onSubmit={add}>
            <div
              className={`
                grid gap-3
                sm:grid-cols-3
              `}
            >
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
            <Button disabled={busy} type="submit">
              Add location
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
