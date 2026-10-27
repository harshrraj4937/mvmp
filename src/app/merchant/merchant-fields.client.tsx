"use client";

import type React from "react";

import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";

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

export function AddressFields({
  disabled,
  error,
  legend,
  onChange,
  prefix,
  value,
}: {
  disabled?: boolean;
  error?: string;
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
  return (
    <fieldset className="grid gap-3" disabled={disabled}>
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <Field
        id={`${prefix}-line1`}
        label="Address line 1"
        onChange={set("line1")}
        required
        value={value.line1}
      />
      <Field
        id={`${prefix}-line2`}
        label="Address line 2 (optional)"
        onChange={set("line2")}
        value={value.line2}
      />
      <div
        className={`
          grid gap-3
          sm:grid-cols-3
        `}
      >
        <Field
          id={`${prefix}-city`}
          label="City"
          onChange={set("city")}
          required
          value={value.city}
        />
        <Field
          id={`${prefix}-state`}
          label="State"
          onChange={set("state")}
          required
          value={value.state}
        />
        <Field
          id={`${prefix}-postalCode`}
          inputMode="numeric"
          label="PIN code"
          onChange={set("postalCode")}
          required
          value={value.postalCode}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </fieldset>
  );
}

export function Field({ error, hint, id, label, ...input }: FieldProps) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={error ? true : undefined}
        id={id}
        {...input}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="text-sm text-destructive" id={`${id}-error`}>
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
    <div className="grid gap-6">
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Store</h2>
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
        <div className="grid gap-1.5">
          <Label htmlFor="description">Description (optional)</Label>
          <textarea
            className={`
              min-h-24 rounded-md border border-input bg-transparent px-3 py-2
              text-sm shadow-xs
              disabled:cursor-not-allowed disabled:opacity-50
            `}
            disabled={disabled("description")}
            id="description"
            maxLength={1000}
            onChange={text("description")}
            value={values.description}
          />
          {errors.description && (
            <p className="text-sm text-destructive">{errors.description}</p>
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

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Contact</h2>
        <Field
          disabled={disabled("contactName")}
          error={errors.contactName}
          id="contactName"
          label="Owner / contact name"
          onChange={text("contactName")}
          required
          value={values.contactName}
        />
        <div
          className={`
            grid gap-3
            sm:grid-cols-2
          `}
        >
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

      <section className="grid gap-6">
        <AddressFields
          disabled={disabled("businessAddress")}
          error={errors.businessAddress}
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
            legend="Return address"
            onChange={(returnAddress) => {
              onChange({ ...values, returnAddress });
            }}
            prefix="return"
            value={values.returnAddress}
          />
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Business registrations</h2>
        <p className="text-sm text-muted-foreground">
          Optional. Gillu will confirm which registrations your shop needs.
        </p>
        <div
          className={`
            grid gap-3
            sm:grid-cols-3
          `}
        >
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
