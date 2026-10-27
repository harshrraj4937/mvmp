"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { MerchantStatus } from "~/modules/merchants/domain/status";

import { fieldErrors, sendJson } from "~/lib/api-client";
import { suggestSlug } from "~/modules/merchants/domain/slug";
import { PageHeading } from "~/ui/gillu/desk/page-heading";
import { Panel } from "~/ui/gillu/desk/panel";

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
    <>
      <PageHeading
        eyebrow="WELCOME TO GILLU"
        subtitle="Tell us about your shop. You can save it as a draft and submit it for review when you are ready."
        title="Open your shop on Gillu"
      />
      <Panel>
        <form noValidate onSubmit={submit}>
          <ProfileFields
            errors={errors}
            locked={new Set()}
            onChange={change}
            readOnly={false}
            showReturnAddress={!returnSame}
            values={values}
          />
          <label className="check-row">
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

          <section className="form-section">
            <h2>Pickup address</h2>
            <p className="muted">
              Where couriers collect your parcels. You can add more later.
            </p>
            <div className="form-grid three">
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
            <label className="check-row">
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
            {errors.pickup && <p className="field-error">{errors.pickup}</p>}
          </section>

          {formError && (
            <p className="form-message error" role="alert">
              {formError}
            </p>
          )}
          <div className="form-actions">
            <button className="button primary" disabled={saving} type="submit">
              {saving ? "Creating…" : "Create shop"}
            </button>
          </div>
        </form>
      </Panel>
    </>
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
    <>
      <PageHeading
        eyebrow={storeName.toUpperCase()}
        subtitle={copy.body}
        title={copy.title}
      />
      <Panel className="status-panel">
        {status === "REJECTED" && rejectionReason && (
          <blockquote className="notice danger">{rejectionReason}</blockquote>
        )}
        {error && (
          <p className="form-message error" role="alert">
            {error}
          </p>
        )}
        {editable ? (
          <div className="page-actions">
            {canSubmit && (
              <button
                className="button primary"
                disabled={submitting}
                onClick={submitForReview}
                type="button"
              >
                {submitting ? "Submitting…" : "Submit for review"}
              </button>
            )}
            <Link className="button" href="/merchant/profile">
              Edit profile
            </Link>
          </div>
        ) : (
          <p className="muted">
            Your store profile and pickup locations stay available in the menu.
          </p>
        )}
      </Panel>
    </>
  );
}
