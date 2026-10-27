import { db } from "~/db";
import { getMerchantProfile, requireMerchant } from "~/modules/merchants";
import { lockedFieldsFor } from "~/modules/merchants/domain/profile-rules";

import { ProfileForm } from "./page.client";

export default async function MerchantProfilePage() {
  const merchant = await requireMerchant("/merchant/profile");
  const profile = await getMerchantProfile(db, merchant);

  return (
    <ProfileForm
      locked={[...lockedFieldsFor(profile.status)]}
      profile={profile}
      readOnly={merchant.role !== "owner"}
    />
  );
}
