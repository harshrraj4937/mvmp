import { z } from "zod";

import { isStateSlug } from "~/modules/catalog/domain/indian-states";

import { RESERVED_SLUGS } from "../domain/slug";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalText = (max: number) =>
  z.preprocess(blankToUndefined, z.string().trim().max(max).optional());

const optionalCode = (pattern: RegExp, message: string) =>
  z.preprocess(
    blankToUndefined,
    z.string().trim().toUpperCase().regex(pattern, message).optional(),
  );

/** Indian mobile number, stored as +91XXXXXXXXXX. */
const phoneSchema = z
  .string()
  .transform((value) => value.replace(/[\s()-]/g, ""))
  .pipe(
    z
      .string()
      .regex(
        /^(?:\+91|91|0)?[6-9]\d{9}$/,
        "Enter a 10-digit Indian mobile number.",
      ),
  )
  .transform((value) => `+91${value.slice(-10)}`);

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/,
    "Use 3-50 lowercase letters, numbers and hyphens.",
  )
  .refine((value) => !value.includes("--"), "Avoid double hyphens.")
  .refine(
    (value) => !RESERVED_SLUGS.includes(value),
    "That shop URL is reserved.",
  );

export const postalAddressSchema = z.object({
  city: text(2, 80),
  line1: text(3, 200),
  line2: optionalText(200),
  postalCode: z
    .string()
    .transform((value) => value.replace(/\s/g, ""))
    .pipe(z.string().regex(/^[1-9]\d{5}$/, "Enter a 6-digit PIN code.")),
  state: text(2, 80),
});

const pickupFields = z.object({
  address: postalAddressSchema,
  contactName: text(2, 80),
  label: text(2, 40),
  phone: phoneSchema,
});

export const pickupLocationSchema = pickupFields.extend({
  label: text(2, 40).default("Primary"),
});

export const pickupLocationCreateSchema = pickupLocationSchema.extend({
  isPrimary: z.boolean().optional(),
});

export const pickupLocationPatchSchema = pickupFields
  .partial()
  .extend({ isPrimary: z.boolean().optional() })
  .refine(
    (patch) => Object.keys(patch).length > 0,
    "Change at least one field.",
  );

export const onboardingSchema = z.object({
  businessAddress: postalAddressSchema,
  complianceNotes: optionalText(1000),
  contactEmail: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.email("Enter a valid email address."),
  ),
  contactName: text(2, 80),
  contactPhone: phoneSchema,
  description: optionalText(1000),
  fssaiLicense: optionalCode(
    /^\d{14}$/,
    "FSSAI licence numbers have 14 digits.",
  ),
  gstin: optionalCode(
    /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
    "Enter a valid 15-character GSTIN.",
  ),
  logoUrl: z.preprocess(
    blankToUndefined,
    z
      .url({ message: "Enter an https:// image URL.", protocol: /^https$/ })
      .optional(),
  ),
  pan: optionalCode(/^[A-Z]{5}\d{4}[A-Z]$/, "Enter a valid 10-character PAN."),
  pickup: pickupLocationSchema,
  returnAddress: postalAddressSchema,
  slug: slugSchema,
  storeName: text(2, 80),
});

export const profilePatchSchema = onboardingSchema
  .omit({ pickup: true })
  .partial()
  .refine(
    (patch) => Object.keys(patch).length > 0,
    "Change at least one field.",
  );

export const rejectSchema = z.object({ reason: text(5, 500) });

const blankToNull = (value: unknown) =>
  value === null || (typeof value === "string" && value.trim() === "")
    ? null
    : value;

/** The shop's story (spec §5.1); a blank field clears it. */
export const merchantStoryPatchSchema = z
  .object({
    homePlace: z.preprocess(blankToNull, text(2, 60).nullable()),
    homeState: z.preprocess(
      blankToNull,
      z
        .string()
        .trim()
        .refine(isStateSlug, "Choose a state from the list.")
        .nullable(),
    ),
    story: z.preprocess(blankToNull, text(150, 3000).nullable()),
  })
  .partial()
  .refine(
    (patch) => Object.keys(patch).length > 0,
    "Change at least one field.",
  );

export type MerchantStoryPatch = z.output<typeof merchantStoryPatchSchema>;
export type OnboardingInput = z.output<typeof onboardingSchema>;
export type PickupLocationInput = z.output<typeof pickupLocationSchema>;
export type PickupLocationPatch = z.output<typeof pickupLocationPatchSchema>;
export type PostalAddress = z.output<typeof postalAddressSchema>;
export type ProfilePatch = z.output<typeof profilePatchSchema>;
