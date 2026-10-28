import { z } from "zod";

import { isStateSlug } from "~/modules/catalog/domain/indian-states";
import { phoneSchema } from "~/modules/merchants/presentation/schemas";

import {
  FULFILMENT_STATUSES,
  MAKER_CANCEL_REASONS,
  MERCHANT_STEPS,
  PAYMENT_METHODS,
} from "../domain/statuses";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalText = (max: number) =>
  z.preprocess(blankToUndefined, z.string().trim().max(max).optional());

const addressFields = {
  city: text(2, 80),
  fullName: text(2, 80),
  landmark: optionalText(80),
  line1: text(3, 200),
  line2: optionalText(200),
  phone: phoneSchema,
  postalCode: z
    .string()
    .transform((value) => value.replace(/\s/g, ""))
    .pipe(z.string().regex(/^[1-9]\d{5}$/, "Enter a 6-digit PIN code.")),
  state: z.string().trim().refine(isStateSlug, "Choose a state from the list."),
};

/** A shopper's delivery address (India only). */
export const addressSchema = z.object({
  ...addressFields,
  isDefault: z.boolean().optional(),
});

export const addressPatchSchema = addressSchema
  .partial()
  .refine(
    (patch) => Object.keys(patch).length > 0,
    "Change at least one field.",
  );

export const placeOrderSchema = z.object({
  addressId: z.string().min(1).max(64),
  checkoutKey: z.string().regex(/^[\w-]{16,64}$/, "Invalid checkout key."),
  expectedTotalPaise: z.number().int().min(0),
  paymentMethod: z.enum(PAYMENT_METHODS),
});

export const shopperCancelSchema = z.object({
  merchantOrder: z
    .string()
    .regex(/^GIL-\d+-[A-Z]+$/, "Invalid parcel number.")
    .optional(),
  reason: optionalText(300),
});

export const merchantOrderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  status: z.preprocess(
    blankToUndefined,
    z.enum(FULFILMENT_STATUSES).optional(),
  ),
});

export const merchantStatusSchema = z.object({
  to: z.enum(MERCHANT_STEPS),
});

export const merchantCancelSchema = z
  .object({
    note: optionalText(300),
    reason: z.enum(MAKER_CANCEL_REASONS),
  })
  .refine((input) => input.reason !== "OTHER" || input.note !== undefined, {
    message: "Say why you are cancelling.",
    path: ["note"],
  });

export type AddressInput = z.output<typeof addressSchema>;
export type AddressPatch = z.output<typeof addressPatchSchema>;
export type MerchantCancelInput = z.output<typeof merchantCancelSchema>;
export type PlaceOrderInput = z.output<typeof placeOrderSchema>;
export type ShopperCancelInput = z.output<typeof shopperCancelSchema>;
