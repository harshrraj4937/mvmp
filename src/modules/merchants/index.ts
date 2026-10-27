import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "~/db";
import { getSessionUser, requireSession } from "~/modules/identity";
import { ForbiddenError, UnauthorizedError } from "~/platform/errors";

import {
  findMerchantForUser,
  type MerchantContext,
} from "./application/membership";

export type { MerchantContext } from "./application/membership";
export {
  addPickupLocation,
  listPickupLocations,
  type PickupLocation,
  updatePickupLocation,
} from "./application/pickup";
export {
  getMerchantProfile,
  type MerchantProfile,
  submitMerchant,
  updateMerchantProfile,
} from "./application/profile";
export { registerMerchant } from "./application/register";
export {
  approveMerchant,
  getMerchantForAdmin,
  listMerchants,
  type MerchantAdminDetail,
  type MerchantListItem,
  reinstateMerchant,
  rejectMerchant,
  suspendMerchant,
} from "./application/review";
export type { MerchantRole } from "./domain/profile-rules";
export {
  canSell,
  MERCHANT_STATUSES,
  type MerchantStatus,
} from "./domain/status";
export {
  onboardingSchema,
  pickupLocationCreateSchema,
  pickupLocationPatchSchema,
  profilePatchSchema,
  rejectSchema,
} from "./presentation/schemas";

/**
 * API/data guard: the caller's merchant from their membership, or 401/403.
 * Status is read fresh on every request, so a suspension applies at once.
 */
export async function authorizeMerchant(): Promise<MerchantContext> {
  const merchant = await getCurrentMerchant();
  if (merchant) {
    return merchant;
  }
  if (!(await getSessionUser())) {
    throw new UnauthorizedError();
  }
  throw new ForbiddenError("You do not have a shop yet.");
}

/** The signed-in user's merchant, or null. Cached per request. */
export const getCurrentMerchant = cache(
  async (): Promise<MerchantContext | null> => {
    const user = await getSessionUser();
    return user ? findMerchantForUser(db, user.id) : null;
  },
);

/** Page guard for approved-merchant pages; others go to onboarding. */
export async function requireApprovedMerchant(
  nextPath: string,
): Promise<MerchantContext> {
  const merchant = await requireMerchant(nextPath);
  if (merchant.status !== "APPROVED") {
    redirect("/merchant/onboarding");
  }
  return merchant;
}

/** Page guard: sign-in (returning to `nextPath`), then onboarding if no shop. */
export async function requireMerchant(
  nextPath: string,
): Promise<MerchantContext> {
  await requireSession(nextPath);
  const merchant = await getCurrentMerchant();
  if (!merchant) {
    redirect("/merchant/onboarding");
  }
  return merchant;
}
