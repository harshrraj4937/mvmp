import { redirect } from "next/navigation";

import { db } from "~/db";
import { requireSession } from "~/modules/identity";
import { getCurrentMerchant, getMerchantProfile } from "~/modules/merchants";

import { OnboardingForm, ShopStatus } from "./page.client";

export default async function MerchantOnboardingPage() {
  const user = await requireSession("/merchant/onboarding");
  const merchant = await getCurrentMerchant();

  if (!merchant) {
    return <OnboardingForm defaultEmail={user.email} defaultName={user.name} />;
  }

  const profile = await getMerchantProfile(db, merchant);
  if (profile.status === "APPROVED") {
    redirect("/merchant/dashboard");
  }
  return (
    <ShopStatus
      canSubmit={merchant.role === "owner"}
      rejectionReason={profile.rejectionReason}
      status={profile.status}
      storeName={profile.storeName}
    />
  );
}
