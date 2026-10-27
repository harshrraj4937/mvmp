import type { MerchantStatus } from "./status";

export type MerchantRole = "owner" | "staff";

/** Editable merchant profile fields (pickup locations are managed separately). */
export const PROFILE_FIELDS = [
  "businessAddress",
  "complianceNotes",
  "contactEmail",
  "contactName",
  "contactPhone",
  "description",
  "fssaiLicense",
  "gstin",
  "logoUrl",
  "pan",
  "returnAddress",
  "slug",
  "storeName",
] as const;

export type ProfileField = (typeof PROFILE_FIELDS)[number];

// Changing these after approval would bypass the admin review.
const reviewedFields: readonly ProfileField[] = [
  "fssaiLicense",
  "gstin",
  "pan",
  "slug",
  "storeName",
];

export function canManageProfile(role: MerchantRole): boolean {
  return role === "owner";
}

export function lockedFieldsFor(
  status: MerchantStatus,
): ReadonlySet<ProfileField> {
  switch (status) {
    case "APPROVED":
    case "SUSPENDED":
      return new Set<ProfileField>(reviewedFields);
    case "DRAFT":
    case "REJECTED":
      return new Set<ProfileField>();
    case "SUBMITTED":
      return new Set<ProfileField>(PROFILE_FIELDS);
  }
}
