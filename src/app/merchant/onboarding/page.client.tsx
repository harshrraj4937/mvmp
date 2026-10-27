"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { MerchantStatus } from "~/modules/merchants/domain/status";

import { fieldErrors, sendJson } from "~/lib/api-client";
import { suggestSlug } from "~/modules/merchants/domain/slug";
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
  type AddressValues,
  emptyAddress,
  Field,
  ProfileFields,
  type ProfileValues,
} from "../merchant-fields.client";

export function OnboardingForm({
  defaultEmail,
  defaultName,
}: {
  defaultEmail: string;
  defaultName: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ProfileValues>({
    businessAddress: emptyAddress,
    complianceNotes: "",
    contactEmail: defaultEmail,
    contactName: defaultName,
    contactPhone: "",
    description: "",
    fssaiLicense: "",
    gstin: "",
    logoUrl: "",
    pan: "",
    returnAddress: emptyAddress,
    slug: "",
    storeName: "",
  });
  const [slugEdited, setSlugEdited] = useState(false);
  const [returnSame, setReturnSame] = useState(true);
  const [pickupSame, setPickupSame] = useState(true);
  const [pickup, setPickup] = useState({
    address: emptyAddress as AddressValues,
    contactName: "",
    label: "Primary",
    phone: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const change = (next: ProfileValues) => {
    if (next.slug !== values.slug) {
      setSlugEdited(true);
      setValues(next);
    } else if (!slugEdited && next.storeName !== values.storeName) {
      setValues({ ...next, slug: suggestSlug(next.storeName) });
    } else {
      setValues(next);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    const result = await sendJson("/api/v1/merchant/onboarding", "POST", {
      ...values,
      pickup: {
        address: pickupSame ? values.businessAddress : pickup.address,
        contactName: pickup.contactName,
        label: pickup.label,
        phone: pickup.phone,
      },
      returnAddress: returnSame ? values.businessAddress : values.returnAddress,
    });
    setSaving(false);
    if (result.error) {
      setErrors(fieldErrors(result.error));
      setFormError(result.error.message);
      return;
    }
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Open your shop on Gillu</CardTitle>
        <CardDescription>
          Tell us about your shop. You can save it as a draft and submit it for
          review when you are ready.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-8" noValidate onSubmit={submit}>
          <ProfileFields
            errors={errors}
            locked={new Set()}
            onChange={change}
            readOnly={false}
            showReturnAddress={!returnSame}
            values={values}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              checked={returnSame}
              id="return-same"
              onChange={(event) => {
                setReturnSame(event.target.checked);
              }}
              type="checkbox"
            />
            Return address same as business address
          </label>

          <section className="grid gap-3">
            <h2 className="text-lg font-semibold">Pickup address</h2>
            <p className="text-sm text-muted-foreground">
              Where couriers collect your parcels. You can add more later.
            </p>
            <div
              className={`
                grid gap-3
                sm:grid-cols-3
              `}
            >
              <Field
                id="pickup-label"
                label="Label"
                onChange={(event) => {
                  setPickup({ ...pickup, label: event.target.value });
                }}
                value={pickup.label}
              />
              <Field
                id="pickup-contactName"
                label="Contact name"
                onChange={(event) => {
                  setPickup({ ...pickup, contactName: event.target.value });
                }}
                required
                value={pickup.contactName}
              />
              <Field
                id="pickup-phone"
                inputMode="tel"
                label="Contact mobile"
                onChange={(event) => {
                  setPickup({ ...pickup, phone: event.target.value });
                }}
                required
                value={pickup.phone}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={pickupSame}
                id="pickup-same"
                onChange={(event) => {
                  setPickupSame(event.target.checked);
                }}
                type="checkbox"
              />
              Pickup address same as business address
            </label>
            {!pickupSame && (
              <AddressFields
                legend="Pickup location"
                onChange={(address) => {
                  setPickup({ ...pickup, address });
                }}
                prefix="pickup"
                value={pickup.address}
              />
            )}
            {errors.pickup && (
              <p className="text-sm text-destructive">{errors.pickup}</p>
            )}
          </section>

          {formError && (
            <p className="text-sm font-medium text-destructive" role="alert">
              {formError}
            </p>
          )}
          <Button disabled={saving} type="submit">
            {saving ? "Creating…" : "Create shop"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

const statusCopy: Record<
  Exclude<MerchantStatus, "APPROVED">,
  { body: string; title: string }
> = {
  DRAFT: {
    body: "Check your details, then submit your shop for review.",
    title: "Your shop is a draft",
  },
  REJECTED: {
    body: "A Gillu admin asked for changes before approving your shop.",
    title: "Your shop needs changes",
  },
  SUBMITTED: {
    body: "A Gillu admin will review your shop. You can come back to this page to check its status.",
    title: "Your shop is under review",
  },
  SUSPENDED: {
    body: "Contact Gillu support to restore your shop.",
    title: "Your shop is suspended",
  },
};

export function ShopStatus({
  canSubmit,
  rejectionReason,
  status,
  storeName,
}: {
  canSubmit: boolean;
  rejectionReason: null | string;
  status: Exclude<MerchantStatus, "APPROVED">;
  storeName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const copy = statusCopy[status];
  const editable = status === "DRAFT" || status === "REJECTED";

  const submitForReview = async () => {
    setSubmitting(true);
    setError("");
    const result = await sendJson("/api/v1/merchant/profile/submit", "POST");
    setSubmitting(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardDescription>{storeName}</CardDescription>
        <CardTitle>{copy.title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">{copy.body}</p>
        {status === "REJECTED" && rejectionReason && (
          <blockquote className="border-l-2 pl-3 text-sm">
            {rejectionReason}
          </blockquote>
        )}
        {error && (
          <p className="text-sm font-medium text-destructive" role="alert">
            {error}
          </p>
        )}
        {editable && (
          <div className="flex flex-wrap gap-3">
            {canSubmit && (
              <Button disabled={submitting} onClick={submitForReview}>
                {submitting ? "Submitting…" : "Submit for review"}
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href="/merchant/profile">Edit profile</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
