import { z } from "zod";

import { suggestSlug } from "~/lib/slug";

import {
  COMPOSITION_LABELS,
  MADE_HOW,
  type MadeHow,
  STOCK_REASONS,
} from "../domain/constants";
import { isStateSlug, type StateSlug } from "../domain/indian-states";
import { parseRupees } from "../domain/money";
import { PRODUCT_STATUSES } from "../domain/product-status";
import { normalizeSku } from "../domain/sku";

const categoryFields = z.object({
  compositionLabel: z.enum(COMPOSITION_LABELS),
  isActive: z.boolean(),
  name: z.string().trim().min(2).max(60),
  sortOrder: z.number().int().min(0).max(100_000),
});

export const categoryCreateSchema = categoryFields
  .pick({ compositionLabel: true, name: true, sortOrder: true })
  .partial({ compositionLabel: true, sortOrder: true });

export const categoryPatchSchema = categoryFields
  .partial()
  .refine(
    (patch) => Object.keys(patch).length > 0,
    "Change at least one field.",
  );

export type CategoryCreate = z.output<typeof categoryCreateSchema>;
export type CategoryPatch = z.output<typeof categoryPatchSchema>;

export const MRP_BELOW_PRICE = "Price cannot be higher than the declared MRP.";

const blank = (value: unknown) =>
  value === undefined ||
  value === null ||
  (typeof value === "string" && value.trim() === "");

/** Form fields arrive as strings; numbers are accepted too. */
const wholeNumber = (min: number, max: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && /^\s*-?\d+\s*$/.test(value)
        ? Number.parseInt(value, 10)
        : value,
    z.number().int().min(min).max(max),
  );

const rupees = z.union([z.string(), z.number()]).transform((value, ctx) => {
  const paise = parseRupees(String(value));
  if (paise === null) {
    ctx.addIssue({
      code: "custom",
      message: "Enter a price in rupees, like 399 or 1299.50.",
    });
    return z.NEVER;
  }
  return paise;
});

const sku = z.string().transform((value, ctx) => {
  const normalized = normalizeSku(value);
  if (normalized === null) {
    ctx.addIssue({
      code: "custom",
      message: "Use 1–40 letters, digits, hyphens or underscores.",
    });
    return z.NEVER;
  }
  return normalized;
});

const label = z.string().trim().min(1).max(40);

const variantShape = {
  heightMm: wholeNumber(1, 2000),
  label: label.optional(),
  lengthMm: wholeNumber(1, 2000),
  mrp: z.preprocess(
    (value) => (blank(value) ? undefined : value),
    rupees.optional(),
  ),
  price: rupees,
  sku,
  weightGrams: wholeNumber(1, 50_000),
  widthMm: wholeNumber(1, 2000),
};

const mrpCoversPrice = (variant: { mrp?: null | number; price?: number }) =>
  variant.mrp === undefined ||
  variant.mrp === null ||
  variant.price === undefined ||
  variant.mrp >= variant.price;

const mrpIssue = { message: MRP_BELOW_PRICE, path: ["mrp"] };

export const variantFieldsSchema = z
  .object(variantShape)
  .refine(mrpCoversPrice, mrpIssue);

const initialStock = wholeNumber(0, 100_000);

const isBlank = (value: unknown) =>
  value === null || (typeof value === "string" && value.trim() === "");

const stateSlug = z
  .string()
  .trim()
  .refine(isStateSlug, "Choose a state from the list.");

/** A product's story fields (spec §4.1). */
const composition = z.string().trim().min(3).max(1000);
const madeBy = z.string().trim().min(2).max(80);
const madeHow = z.enum(MADE_HOW);
const originPlace = z.string().trim().min(2).max(60);

/** On create a blank story field means "not given yet". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) => (isBlank(value) ? undefined : value),
    schema.optional(),
  );

/** On patch a blank story field clears it. */
const clearable = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (isBlank(value) ? null : value), schema.nullable());

export const productCreateSchema = z.object({
  categoryId: z.string().trim().min(1, "Choose a category."),
  composition: optional(composition),
  description: z.preprocess(
    (value) => (blank(value) ? undefined : value),
    z.string().trim().max(5000).optional(),
  ),
  initialStock,
  madeBy: optional(madeBy),
  madeHow: optional(madeHow),
  name: z.string().trim().min(2).max(120),
  originPlace: optional(originPlace),
  originState: optional(stateSlug),
  variant: variantFieldsSchema,
});

export const productPatchSchema = z
  .object({
    categoryId: z.string().trim().min(1, "Choose a category."),
    composition: clearable(composition),
    // An empty description clears it.
    description: z.preprocess(
      (value) => (blank(value) ? null : value),
      z.string().trim().max(5000).nullable(),
    ),
    madeBy: clearable(madeBy),
    madeHow: clearable(madeHow),
    name: z.string().trim().min(2).max(120),
    originPlace: clearable(originPlace),
    originState: clearable(stateSlug),
    slug: z
      .string()
      .transform((value) => suggestSlug(value))
      .pipe(
        z.string().min(1, "Use letters or digits in the product URL.").max(80),
      ),
  })
  .partial()
  .refine(
    (patch) => Object.keys(patch).length > 0,
    "Change at least one field.",
  );

export const variantCreateSchema = z
  .object({ ...variantShape, initialStock, label })
  .refine(mrpCoversPrice, mrpIssue);

export const variantPatchSchema = z
  .object({
    ...variantShape,
    isActive: z.boolean(),
    label,
    // An empty MRP clears it.
    mrp: z.preprocess(
      (value) => (blank(value) ? null : value),
      rupees.nullable(),
    ),
  })
  .partial()
  .refine(
    (patch) => Object.keys(patch).length > 0,
    "Change at least one field.",
  )
  .refine(mrpCoversPrice, mrpIssue);

/** Alt text and position of a product image. */
export const imagePatchSchema = z
  .object({
    alt: z.string().trim().min(1).max(200),
    sortOrder: wholeNumber(0, 10_000),
  })
  .partial()
  .refine(
    (patch) => Object.keys(patch).length > 0,
    "Change at least one field.",
  );

const optionalParam = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) => (blank(value) ? undefined : value),
    schema.optional(),
  );

/** `?q` and `?status` for product lists (merchant and admin). */
export const productListQuerySchema = z.object({
  q: optionalParam(z.string().trim().max(100)),
  status: optionalParam(z.enum(PRODUCT_STATUSES)),
});

/** An admin hold: why the product was taken down, shown to the merchant. */
export const holdSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});

export const stockAdjustmentSchema = z.object({
  delta: wholeNumber(-100_000, 100_000).refine(
    (delta) => delta !== 0,
    "Enter a change other than 0.",
  ),
  note: z.preprocess(
    (value) => (blank(value) ? undefined : value),
    z.string().trim().max(200).optional(),
  ),
  reason: z.enum(STOCK_REASONS).exclude(["INITIAL"]),
});

export type Hold = z.output<typeof holdSchema>;
export type ImagePatch = z.output<typeof imagePatchSchema>;
export type ProductCreate = z.output<typeof productCreateSchema>;
export type ProductPatch = z.output<typeof productPatchSchema>;
/** A product's story as stored (null = not given). */
export interface ProductStory {
  composition: null | string;
  madeBy: null | string;
  madeHow: MadeHow | null;
  originPlace: null | string;
  originState: null | StateSlug;
}
export type StockAdjustment = z.output<typeof stockAdjustmentSchema>;
export type VariantCreate = z.output<typeof variantCreateSchema>;
export type VariantFields = z.output<typeof variantFieldsSchema>;
export type VariantPatch = z.output<typeof variantPatchSchema>;
