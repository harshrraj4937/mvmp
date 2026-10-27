import Image from "next/image";

import { db } from "~/db";
import { getMerchantProfile, requireMerchant } from "~/modules/merchants";
import { lockedFieldsFor } from "~/modules/merchants/domain/profile-rules";
import { storeInitials } from "~/ui/gillu/desk/desk-shell";
import { PageHeading } from "~/ui/gillu/desk/page-heading";

import { ProfileForm } from "./page.client";

export default async function MerchantProfilePage() {
  const merchant = await requireMerchant("/merchant/profile");
  const profile = await getMerchantProfile(db, merchant);

  return (
    <>
      <PageHeading
        subtitle="Make the hands behind the handmade a little more familiar."
        title="Your store, your story."
      />
      <div className="profile-grid">
        <section className="panel store-card">
          <Image
            alt="Representative store imagery"
            className="store-cover"
            height={800}
            src="/gillu/hands.webp"
            width={1200}
          />
          <div className="store-content">
            <span className="store-avatar">
              {storeInitials(profile.storeName)}
            </span>
            <p className="eyebrow">YOUR GILLU STORE</p>
            <h2>{profile.storeName}</h2>
            <p>
              {profile.description ??
                "Add a few lines about your shop in Store details."}
            </p>
            <span className="pill">{profile.businessAddress.city}, India</span>
          </div>
        </section>
        <ProfileForm
          locked={[...lockedFieldsFor(profile.status)]}
          profile={profile}
          readOnly={merchant.role !== "owner"}
        />
      </div>
    </>
  );
}
