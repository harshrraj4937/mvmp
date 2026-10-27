import { ConflictError } from "~/platform/errors";

/**
 * Product states. PENDING_APPROVAL is reserved for admin pre-approval
 * (not used: merchants publish directly, ADR-026).
 */
export const PRODUCT_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "PUBLISHED",
  "UNPUBLISHED",
  "ARCHIVED",
] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

const transitions: Record<ProductStatus, readonly ProductStatus[]> = {
  ARCHIVED: [],
  DRAFT: ["PUBLISHED", "ARCHIVED"],
  PENDING_APPROVAL: [],
  PUBLISHED: ["UNPUBLISHED", "ARCHIVED"],
  UNPUBLISHED: ["PUBLISHED", "ARCHIVED"],
};

export function assertProductTransition(
  from: ProductStatus,
  to: ProductStatus,
): void {
  if (!canTransitionProduct(from, to)) {
    throw new ConflictError(
      "invalid_transition",
      `A ${from.toLowerCase().replace("_", " ")} product cannot become ${to.toLowerCase().replace("_", " ")}.`,
    );
  }
}

export function canTransitionProduct(
  from: ProductStatus,
  to: ProductStatus,
): boolean {
  return transitions[from].includes(to);
}

/** The states a product may move to `to` from (for guarded UPDATEs). */
export function productStatusesAllowedBefore(
  to: ProductStatus,
): ProductStatus[] {
  return PRODUCT_STATUSES.filter((from) => canTransitionProduct(from, to));
}
