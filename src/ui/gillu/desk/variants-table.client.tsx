"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { VariantView } from "~/modules/catalog";

import { Field } from "~/app/merchant/merchant-fields.client";
import { fieldErrors, sendJson } from "~/lib/api-client";
import { formatPaise } from "~/modules/catalog/domain/money";

import { Icon } from "./icon";
import { Modal } from "./modal.client";
import { MRP_LABEL, PackFields, PRICE_LABEL } from "./product-form.client";
import { StockDialog } from "./stock-dialog.client";

type VariantValues = Record<
  | "heightMm"
  | "initialStock"
  | "label"
  | "lengthMm"
  | "mrp"
  | "price"
  | "sku"
  | "weightGrams"
  | "widthMm",
  string
>;

const EMPTY: VariantValues = {
  heightMm: "",
  initialStock: "0",
  label: "",
  lengthMm: "",
  mrp: "",
  price: "",
  sku: "",
  weightGrams: "",
  widthMm: "",
};

const variantName = (variant: VariantView) => variant.label ?? "Default";

/** The product's variants with stock, plus add, switch off and adjust stock. */
export function VariantsTable({
  productId,
  readOnly,
  variants,
}: {
  productId: string;
  readOnly: boolean;
  variants: VariantView[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [stockFor, setStockFor] = useState<null | VariantView>(null);
  const [editing, setEditing] = useState<null | VariantView>(null);
  const [message, setMessage] = useState("");

  async function toggle(variant: VariantView) {
    const result = await sendJson(
      `/api/v1/merchant/products/${productId}/variants/${variant.id}`,
      "PATCH",
      { isActive: !variant.isActive },
    );
    setMessage(result.error ? result.error.message : "");
    if (!result.error) {
      router.refresh();
    }
  }

  return (
    <>
      {/* Rows hold buttons, so keyboard focus scrolls the table on narrow screens. */}
      <div className="table-scroll">
        <table className="orders-table variants-table">
          <thead>
            <tr>
              {["Variant", "SKU", "Price", "MRP", "In stock", "Status"].map(
                (title) => (
                  <th key={title} scope="col">
                    {title}
                  </th>
                ),
              )}
              {!readOnly && (
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {variants.map((variant) => (
              <tr key={variant.id}>
                <td>{variantName(variant)}</td>
                <td>{variant.sku}</td>
                <td className="amount">{formatPaise(variant.pricePaise)}</td>
                <td>
                  {variant.declaredMrpPaise === null
                    ? "—"
                    : formatPaise(variant.declaredMrpPaise)}
                </td>
                <td>{variant.available}</td>
                <td>{variant.isActive ? "On sale" : "Switched off"}</td>
                {!readOnly && (
                  <td>
                    <div className="row">
                      <button
                        className="button small"
                        onClick={() => setEditing(variant)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="button small"
                        onClick={() => setStockFor(variant)}
                        type="button"
                      >
                        Adjust stock
                      </button>
                      <button
                        className="text-button small"
                        onClick={() => void toggle(variant)}
                        type="button"
                      >
                        {variant.isActive ? "Switch off" : "Switch on"}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {message && (
        <p className="notice danger" role="alert">
          {message}
        </p>
      )}
      {!readOnly && (
        <div className="form-actions">
          <button
            className="button"
            onClick={() => setAdding(true)}
            type="button"
          >
            <Icon name="plus" />
            Add variant
          </button>
        </div>
      )}
      <AddVariantDialog
        onClose={() => setAdding(false)}
        open={adding}
        productId={productId}
        unlabelled={variants.find((variant) => variant.label === null)}
      />
      <EditVariantDialog
        onClose={() => setEditing(null)}
        productId={productId}
        variant={editing}
      />
      <StockDialog
        onClose={() => setStockFor(null)}
        variant={
          stockFor && {
            available: stockFor.available,
            id: stockFor.id,
            name: variantName(stockFor),
          }
        }
      />
    </>
  );
}

function AddVariantDialog({
  onClose,
  open,
  productId,
  unlabelled,
}: {
  onClose: () => void;
  open: boolean;
  productId: string;
  unlabelled?: VariantView;
}) {
  const router = useRouter();
  const [values, setValues] = useState(EMPTY);
  const [existingLabel, setExistingLabel] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const set =
    (key: keyof VariantValues) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setValues({ ...values, [key]: event.target.value });
    };

  function close() {
    setValues(EMPTY);
    setExistingLabel("");
    setErrors({});
    setMessage("");
    onClose();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    // With more than one variant every variant needs a label, so the one
    // the product started with is named first.
    if (unlabelled) {
      const named = await sendJson(
        `/api/v1/merchant/products/${productId}/variants/${unlabelled.id}`,
        "PATCH",
        { label: existingLabel },
      );
      if (named.error) {
        setSaving(false);
        const label = fieldErrors(named.error).label;
        setErrors(label ? { existingLabel: label } : {});
        setMessage(label ? "" : named.error.message);
        return;
      }
    }
    const result = await sendJson(
      `/api/v1/merchant/products/${productId}/variants`,
      "POST",
      values,
    );
    setSaving(false);
    if (result.error) {
      const next = fieldErrors(result.error);
      if (result.error.code === "sku_taken") {
        next.sku = result.error.message;
      }
      setErrors(next);
      setMessage(Object.keys(next).length > 0 ? "" : result.error.message);
      router.refresh();
      return;
    }
    close();
    router.refresh();
  }

  return (
    <Modal
      onClose={close}
      open={open}
      subtitle="Another size, flavour or pack of this product."
      title="Add a variant"
    >
      <form noValidate onSubmit={submit}>
        <div className="form-grid">
          {unlabelled && (
            <div className="full">
              <Field
                error={errors.existingLabel}
                hint={`Your current variant (SKU ${unlabelled.sku}) needs a name too.`}
                id="existingLabel"
                label="Name for your current variant"
                maxLength={40}
                onChange={(event) => setExistingLabel(event.target.value)}
                placeholder="Like 500 g"
                required
                value={existingLabel}
              />
            </div>
          )}
          <Field
            error={errors.label}
            id="variantLabel"
            label="Variant name"
            maxLength={40}
            onChange={set("label")}
            placeholder="Like 250 g or Large"
            required
            value={values.label}
          />
          <Field
            error={errors.sku}
            id="variantSku"
            label="SKU"
            onChange={set("sku")}
            required
            value={values.sku}
          />
          <Field
            error={errors.price}
            id="variantPrice"
            inputMode="decimal"
            label={PRICE_LABEL}
            onChange={set("price")}
            required
            value={values.price}
          />
          <Field
            error={errors.mrp}
            id="variantMrp"
            inputMode="decimal"
            label={MRP_LABEL}
            onChange={set("mrp")}
            value={values.mrp}
          />
          <Field
            error={errors.initialStock}
            id="variantInitialStock"
            inputMode="numeric"
            label="Stock on hand"
            onChange={set("initialStock")}
            required
            value={values.initialStock}
          />
        </div>
        <PackFields
          errors={errors}
          onChange={set}
          prefix="variant"
          values={values}
        />
        {message && (
          <p className="notice danger" role="alert">
            {message}
          </p>
        )}
        <div className="form-actions">
          <button className="button primary" disabled={saving} type="submit">
            Add variant
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Paise as the rupee text a merchant would type ("1299", "1299.5"). */
const rupees = (paise: null | number) =>
  paise === null ? "" : String(paise / 100);

type EditValues = Omit<VariantValues, "initialStock">;

function editValues(variant: VariantView): EditValues {
  return {
    heightMm: String(variant.heightMm),
    label: variant.label ?? "",
    lengthMm: String(variant.lengthMm),
    mrp: rupees(variant.declaredMrpPaise),
    price: rupees(variant.pricePaise),
    sku: variant.sku,
    weightGrams: String(variant.weightGrams),
    widthMm: String(variant.widthMm),
  };
}

/** Edits price, MRP, SKU, label and pack size; only changed fields are sent. */
function EditVariantDialog({
  onClose,
  productId,
  variant,
}: {
  onClose: () => void;
  productId: string;
  variant: null | VariantView;
}) {
  return (
    <Modal
      onClose={onClose}
      open={variant !== null}
      subtitle="Changes to a published product go live at once."
      title="Edit variant"
    >
      {variant && (
        <EditVariantForm
          key={variant.id}
          onDone={onClose}
          productId={productId}
          variant={variant}
        />
      )}
    </Modal>
  );
}

function EditVariantForm({
  onDone,
  productId,
  variant,
}: {
  onDone: () => void;
  productId: string;
  variant: VariantView;
}) {
  const router = useRouter();
  const initial = editValues(variant);
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const set =
    (key: keyof EditValues) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setValues({ ...values, [key]: event.target.value });
    };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const patch = Object.fromEntries(
      (Object.keys(values) as (keyof EditValues)[])
        .filter((key) => values[key] !== initial[key])
        .map((key) => [key, values[key]]),
    );
    if (Object.keys(patch).length === 0) {
      onDone();
      return;
    }
    setSaving(true);
    const result = await sendJson(
      `/api/v1/merchant/products/${productId}/variants/${variant.id}`,
      "PATCH",
      patch,
    );
    setSaving(false);
    if (result.error) {
      const next = fieldErrors(result.error);
      if (result.error.code === "sku_taken") {
        next.sku = result.error.message;
      }
      setErrors(next);
      setMessage(Object.keys(next).length > 0 ? "" : result.error.message);
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <form noValidate onSubmit={submit}>
      <div className="form-grid">
        {variant.label !== null && (
          <Field
            error={errors.label}
            id="editLabel"
            label="Variant name"
            maxLength={40}
            onChange={set("label")}
            required
            value={values.label}
          />
        )}
        <Field
          error={errors.sku}
          id="editSku"
          label="SKU"
          onChange={set("sku")}
          required
          value={values.sku}
        />
        <Field
          error={errors.price}
          id="editPrice"
          inputMode="decimal"
          label={PRICE_LABEL}
          onChange={set("price")}
          required
          value={values.price}
        />
        <Field
          error={errors.mrp}
          hint="Leave empty if the pack has no printed MRP."
          id="editMrp"
          inputMode="decimal"
          label={MRP_LABEL}
          onChange={set("mrp")}
          value={values.mrp}
        />
      </div>
      <PackFields
        errors={errors}
        onChange={set}
        prefix="edit"
        values={values}
      />
      {message && (
        <p className="notice danger" role="alert">
          {message}
        </p>
      )}
      <div className="form-actions">
        <button className="button primary" disabled={saving} type="submit">
          Save variant
        </button>
      </div>
    </form>
  );
}
