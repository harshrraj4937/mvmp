"use client";

import type React from "react";

export interface AddressValues {
  city: string;
  line1: string;
  line2: string;
  postalCode: string;
  state: string;
}

/** Form state for the shop profile; every value is the raw input string. */
export interface ProfileValues {
  businessAddress: AddressValues;
  complianceNotes: string;
  contactEmail: string;
  contactName: string;
  contactPhone: string;
  description: string;
  fssaiLicense: string;
  gstin: string;
  logoUrl: string;
  pan: string;
  returnAddress: AddressValues;
  slug: string;
  storeName: string;
}

export const emptyAddress: AddressValues = {
  city: "",
  line1: "",
  line2: "",
  postalCode: "",
  state: "",
};

interface FieldProps extends React.ComponentProps<"input"> {
  error?: string;
  hint?: string;
  id: string;
  label: string;
}

/**
 * `errors` is the page's error map keyed by API path (e.g.
 * "businessAddress.line1"); `errorKey` is the address path ("businessAddress").
 * Each message sits under its own input. `error` is only a fallback for
 * address-level errors with no field to attach to.
 */
export function AddressFields({
  disabled,
  error,
  errorKey,
  errors,
  legend,
  onChange,
  prefix,
  value,
}: {
  disabled?: boolean;
  error?: string;
  errorKey?: string;
  errors?: Record<string, string>;
  legend: string;
  onChange: (value: AddressValues) => void;
  prefix: string;
  value: AddressValues;
}) {
  const set =
    (key: keyof AddressValues) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...value, [key]: event.target.value });
    };
  const fieldError = (key: keyof AddressValues) =>
    errorKey ? errors?.[`${errorKey}.${key}`] : undefined;
  const hasFieldError = (
    ["city", "line1", "line2", "postalCode", "state"] as const
  ).some((key) => fieldError(key));
  return (
    <fieldset className="form-fieldset" disabled={disabled}>
      <legend>{legend}</legend>
      <Field
        error={fieldError("line1")}
        id={`${prefix}-line1`}
        label="Address line 1"
        onChange={set("line1")}
        required
        value={value.line1}
      />
      <Field
        error={fieldError("line2")}
        id={`${prefix}-line2`}
        label="Address line 2 (optional)"
        onChange={set("line2")}
        value={value.line2}
      />
      <div className="form-grid three">
        <Field
          error={fieldError("city")}
          id={`${prefix}-city`}
          label="City"
          onChange={set("city")}
          required
          value={value.city}
        />
        <Field
          error={fieldError("state")}
          id={`${prefix}-state`}
          label="State"
          onChange={set("state")}
          required
          value={value.state}
        />
        <Field
          error={fieldError("postalCode")}
          id={`${prefix}-postalCode`}
          inputMode="numeric"
          label="PIN code"
          onChange={set("postalCode")}
          required
          value={value.postalCode}
        />
      </div>
      {error && !hasFieldError && <p className="field-error">{error}</p>}
    </fieldset>
  );
}

export function Field({ error, hint, id, label, ...input }: FieldProps) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={error ? true : undefined}
        id={id}
        {...input}
      />
      {hint && <p className="field-hint">{hint}</p>}
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Store, contact, address and compliance fields shared by onboarding and
 * the profile page. `locked` fields are shown but cannot be changed.
 */
export function ProfileFields({
  errors,
  locked,
  onChange,
  readOnly,
  showReturnAddress,
  values,
}: {
  errors: Record<string, string>;
  locked: ReadonlySet<string>;
  onChange: (values: ProfileValues) => void;
  readOnly: boolean;
  showReturnAddress: boolean;
  values: ProfileValues;
}) {
  const disabled = (field: keyof ProfileValues) =>
    readOnly || locked.has(field);
  const hint = (field: keyof ProfileValues, text?: string) =>
    locked.has(field)
      ? "Locked after approval — contact Gillu to change"
      : text;
  const text =
    (field: keyof ProfileValues) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange({ ...values, [field]: event.target.value });
    };

  return (
    <div className="form-sections">
      <section className="form-section">
        <h2>Store</h2>
        <Field
          disabled={disabled("storeName")}
          error={errors.storeName}
          hint={hint("storeName")}
          id="storeName"
          label="Store name"
          onChange={text("storeName")}
          required
          value={values.storeName}
        />
        <Field
          disabled={disabled("slug")}
          error={errors.slug}
          hint={hint(
            "slug",
            `Your shop address: /shops/${values.slug || "your-shop"}`,
          )}
          id="slug"
          label="Shop URL"
          onChange={text("slug")}
          required
          value={values.slug}
        />
        <div className="field">
          <label htmlFor="description">Description (optional)</label>
          <textarea
            disabled={disabled("description")}
            id="description"
            maxLength={1000}
            onChange={text("description")}
            value={values.description}
          />
          {errors.description && (
            <p className="field-error">{errors.description}</p>
          )}
        </div>
        <Field
          disabled={disabled("logoUrl")}
          error={errors.logoUrl}
          hint="Optional https:// link to your logo. Uploads arrive soon."
          id="logoUrl"
          label="Logo URL"
          onChange={text("logoUrl")}
          type="url"
          value={values.logoUrl}
        />
      </section>

      <section className="form-section">
        <h2>Contact</h2>
        <Field
          disabled={disabled("contactName")}
          error={errors.contactName}
          id="contactName"
          label="Owner / contact name"
          onChange={text("contactName")}
          required
          value={values.contactName}
        />
        <div className="form-grid">
          <Field
            disabled={disabled("contactEmail")}
            error={errors.contactEmail}
            id="contactEmail"
            label="Email"
            onChange={text("contactEmail")}
            required
            type="email"
            value={values.contactEmail}
          />
          <Field
            disabled={disabled("contactPhone")}
            error={errors.contactPhone}
            id="contactPhone"
            inputMode="tel"
            label="Mobile number"
            onChange={text("contactPhone")}
            required
            value={values.contactPhone}
          />
        </div>
      </section>

      <section className="form-section">
        <AddressFields
          disabled={disabled("businessAddress")}
          error={errors.businessAddress}
          errorKey="businessAddress"
          errors={errors}
          legend="Business address"
          onChange={(businessAddress) => {
            onChange({ ...values, businessAddress });
          }}
          prefix="business"
          value={values.businessAddress}
        />
        {showReturnAddress && (
          <AddressFields
            disabled={disabled("returnAddress")}
            error={errors.returnAddress}
            errorKey="returnAddress"
            errors={errors}
            legend="Return address"
            onChange={(returnAddress) => {
              onChange({ ...values, returnAddress });
            }}
            prefix="return"
            value={values.returnAddress}
          />
        )}
      </section>

      <section className="form-section">
        <h2>Business registrations</h2>
        <p className="muted">
          Optional. Gillu will confirm which registrations your shop needs.
        </p>
        <div className="form-grid three">
          <Field
            disabled={disabled("gstin")}
            error={errors.gstin}
            hint={hint("gstin")}
            id="gstin"
            label="GSTIN"
            onChange={text("gstin")}
            value={values.gstin}
          />
          <Field
            disabled={disabled("pan")}
            error={errors.pan}
            hint={hint("pan")}
            id="pan"
            label="PAN"
            onChange={text("pan")}
            value={values.pan}
          />
          <Field
            disabled={disabled("fssaiLicense")}
            error={errors.fssaiLicense}
            hint={hint("fssaiLicense")}
            id="fssaiLicense"
            label="FSSAI licence"
            onChange={text("fssaiLicense")}
            value={values.fssaiLicense}
          />
        </div>
        <Field
          disabled={disabled("complianceNotes")}
          error={errors.complianceNotes}
          id="complianceNotes"
          label="Notes for Gillu (optional)"
          onChange={text("complianceNotes")}
          value={values.complianceNotes}
        />
      </section>
    </div>
  );
}
