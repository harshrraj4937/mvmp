import { ConflictError } from "~/platform/errors";

/** Merchant registration states (requirements §8). */
export const MERCHANT_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
] as const;

export type MerchantStatus = (typeof MERCHANT_STATUSES)[number];

const transitions: Record<MerchantStatus, readonly MerchantStatus[]> = {
  APPROVED: ["SUSPENDED"],
  DRAFT: ["SUBMITTED"],
  REJECTED: ["SUBMITTED"],
  SUBMITTED: ["APPROVED", "REJECTED"],
  SUSPENDED: ["APPROVED"],
};

export function assertTransition(
  from: MerchantStatus,
  to: MerchantStatus,
): void {
  if (!canTransition(from, to)) {
    throw new ConflictError(
      "invalid_transition",
      `A ${from.toLowerCase()} shop cannot become ${to.toLowerCase()}.`,
    );
  }
}

/** Only approved merchants may publish products and receive orders. */
export function canSell(status: MerchantStatus): boolean {
  return status === "APPROVED";
}

export function canTransition(
  from: MerchantStatus,
  to: MerchantStatus,
): boolean {
  return transitions[from].includes(to);
}

/** The states a merchant may move to `to` from. */
export function statusesAllowedBefore(to: MerchantStatus): MerchantStatus[] {
  return MERCHANT_STATUSES.filter((from) => canTransition(from, to));
}
