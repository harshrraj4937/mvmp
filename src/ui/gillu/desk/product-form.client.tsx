"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field } from "~/app/merchant/merchant-fields.client";
import { type ApiError, fieldErrors, sendJson } from "~/lib/api-client";

export const PRICE_LABEL = "Price customers pay (including delivery)";
export const MRP_LABEL = "Declared MRP (as printed on the pack, if any)";

interface CategoryOption {
  id: string;
  name: string;
}

interface DetailValues {
  categoryId: string;
  description: string;
  name: string;
}

const VARIANT_KEYS = [
  "price",
  "mrp",
  "sku",
  "weightGrams",
  "lengthMm",
  "widthMm",
  "heightMm",
] as const;

type CreateValues = DetailValues & Record<"initialStock" | VariantKey, string>;

type VariantKey = (typeof VARIANT_KEYS)[number];

/** The new-product form: details, the first variant and opening stock. */
export function NewProductForm({
  categories,
}: {
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<CreateValues>({
    categoryId: "",
    description: "",
    heightMm: "",
    initialStock: "0",
    lengthMm: "",
    mrp: "",
    name: "",
    price: "",
    sku: "",
    weightGrams: "",
    widthMm: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const set =
    (key: keyof CreateValues) =>
    (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      setValues({ ...values, [key]: event.target.value });
    };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const variant = Object.fromEntries(
      VARIANT_KEYS.map((key) => [key, values[key]]),
    );
    const result = await sendJson<{ id: string }>(
      "/api/v1/merchant/products",
      "POST",
      {
        categoryId: values.categoryId,
        description: values.description,
        initialStock: values.initialStock,
        name: values.name,
        variant,
      },
    );
    if (result.error) {
      setSaving(false);
      const next = productErrors(result.error);
      setErrors(next);
      setMessage(Object.keys(next).length > 0 ? "" : result.error.message);
      return;
    }
    router.push(`/merchant/products/${result.data.id}`);
  }

  return (
    <form className="form-sections" noValidate onSubmit={submit}>
      <section className="form-section">
        <h2>About the product</h2>
        <DetailFields
          categories={categories}
          errors={errors}
          onChange={set}
          values={values}
        />
      </section>
      <section className="form-section">
        <h2>Price, pack and stock</h2>
        <p className="muted">
          Customers pay this price; delivery is included. The declared MRP is
          only shown when your pack has one printed.
        </p>
        <div className="form-grid">
          <Field
            error={errors.price}
            id="price"
            inputMode="decimal"
            label={PRICE_LABEL}
            onChange={set("price")}
            placeholder="₹"
            required
            value={values.price}
          />
          <Field
            error={errors.mrp}
            id="mrp"
            inputMode="decimal"
            label={MRP_LABEL}
            onChange={set("mrp")}
            placeholder="₹"
            value={values.mrp}
          />
          <Field
            error={errors.sku}
            hint="Your own code: letters, digits, - and _."
            id="sku"
            label="SKU"
            onChange={set("sku")}
            required
            value={values.sku}
          />
          <Field
            error={errors.initialStock}
            id="initialStock"
            inputMode="numeric"
            label="Stock on hand"
            onChange={set("initialStock")}
            required
            value={values.initialStock}
          />
        </div>
        <PackFields errors={errors} onChange={set} prefix="" values={values} />
      </section>
      {message && (
        <p className="notice danger" role="alert">
          {message}
        </p>
      )}
      <div className="form-actions">
        <button className="button primary" disabled={saving} type="submit">
          Save draft
        </button>
      </div>
    </form>
  );
}

/** Weight and packed dimensions, used for courier rates. */
export function PackFields({
  errors,
  onChange,
  prefix,
  values,
}: {
  errors: Record<string, string>;
  onChange: (
    key: "heightMm" | "lengthMm" | "weightGrams" | "widthMm",
  ) => React.ChangeEventHandler<HTMLInputElement>;
  prefix: string;
  values: Record<"heightMm" | "lengthMm" | "weightGrams" | "widthMm", string>;
}) {
  const id = (key: string) =>
    prefix ? `${prefix}${key[0]?.toUpperCase()}${key.slice(1)}` : key;
  return (
    <div className="form-grid">
      <Field
        error={errors.weightGrams}
        id={id("weightGrams")}
        inputMode="numeric"
        label="Packed weight (grams)"
        onChange={onChange("weightGrams")}
        required
        value={values.weightGrams}
      />
      <Field
        error={errors.lengthMm}
        id={id("lengthMm")}
        inputMode="numeric"
        label="Length (mm)"
        onChange={onChange("lengthMm")}
        required
        value={values.lengthMm}
      />
      <Field
        error={errors.widthMm}
        id={id("widthMm")}
        inputMode="numeric"
        label="Width (mm)"
        onChange={onChange("widthMm")}
        required
        value={values.widthMm}
      />
      <Field
        error={errors.heightMm}
        id={id("heightMm")}
        inputMode="numeric"
        label="Height (mm)"
        onChange={onChange("heightMm")}
        required
        value={values.heightMm}
      />
    </div>
  );
}

/** Name, category and description of an existing product. */
export function ProductDetailsForm({
  categories,
  initial,
  productId,
  readOnly,
}: {
  categories: CategoryOption[];
  initial: DetailValues;
  productId: string;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ error: boolean; text: string }>();
  const [saving, setSaving] = useState(false);

  const set =
    (key: keyof DetailValues) =>
    (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      setValues({ ...values, [key]: event.target.value });
    };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    // Only changed fields are sent: an unchanged hidden category stays valid.
    const patch = Object.fromEntries(
      (Object.keys(values) as (keyof DetailValues)[])
        .filter((key) => values[key] !== initial[key])
        .map((key) => [key, values[key]]),
    );
    if (Object.keys(patch).length === 0) {
      setMessage({ error: false, text: "Nothing has changed." });
      return;
    }
    setSaving(true);
    const result = await sendJson(
      `/api/v1/merchant/products/${productId}`,
      "PATCH",
      patch,
    );
    setSaving(false);
    if (result.error) {
      const next = fieldErrors(result.error);
      setErrors(next);
      setMessage(
        Object.keys(next).length > 0
          ? undefined
          : { error: true, text: result.error.message },
      );
      return;
    }
    setErrors({});
    setMessage({ error: false, text: "Changes saved." });
    router.refresh();
  }

  return (
    <form noValidate onSubmit={submit}>
      <fieldset className="form-fieldset" disabled={readOnly}>
        <DetailFields
          categories={categories}
          errors={errors}
          onChange={set}
          values={values}
        />
      </fieldset>
      {message && (
        <p
          className={message.error ? `notice danger` : "notice green"}
          role={message.error ? "alert" : "status"}
        >
          {message.text}
        </p>
      )}
      {!readOnly && (
        <div className="form-actions">
          <button className="button primary" disabled={saving} type="submit">
            Save changes
          </button>
        </div>
      )}
    </form>
  );
}

/**
 * Field messages for a product request: nested variant errors arrive as
 * "variant.price" and are shown under #price; a taken SKU under #sku.
 */
export function productErrors(error: ApiError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [key, message] of Object.entries(fieldErrors(error))) {
    errors[key.replace(/^variant\./, "")] = message;
  }
  if (error.code === "sku_taken") {
    errors.sku = error.message;
  }
  return errors;
}

function DetailFields({
  categories,
  errors,
  onChange,
  values,
}: {
  categories: CategoryOption[];
  errors: Record<string, string>;
  onChange: (
    key: keyof DetailValues,
  ) => React.ChangeEventHandler<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >;
  values: DetailValues;
}) {
  return (
    <div className="form-grid">
      <div className="full">
        <Field
          error={errors.name}
          id="name"
          label="Product name"
          maxLength={120}
          onChange={onChange("name")}
          required
          value={values.name}
        />
      </div>
      <div className="field">
        <label htmlFor="categoryId">Category</label>
        <select
          aria-describedby={errors.categoryId ? "categoryId-error" : undefined}
          aria-invalid={errors.categoryId ? true : undefined}
          id="categoryId"
          onChange={onChange("categoryId")}
          required
          value={values.categoryId}
        >
          <option disabled value="">
            Choose a category
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {errors.categoryId && (
          <p className="field-error" id="categoryId-error">
            {errors.categoryId}
          </p>
        )}
      </div>
      <div className="field full">
        <label htmlFor="description">Description (optional)</label>
        <textarea
          aria-describedby={
            errors.description ? "description-error" : undefined
          }
          id="description"
          maxLength={5000}
          onChange={onChange("description")}
          rows={4}
          value={values.description}
        />
        {errors.description && (
          <p className="field-error" id="description-error">
            {errors.description}
          </p>
        )}
      </div>
    </div>
  );
}
