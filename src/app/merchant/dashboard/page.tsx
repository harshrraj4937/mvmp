import Image from "next/image";
import Link from "next/link";

import { db } from "~/db";
import {
  getMerchantProfile,
  listPickupLocations,
  requireApprovedMerchant,
} from "~/modules/merchants";
import { DeskBadge } from "~/ui/gillu/desk/badge";
import { Icon } from "~/ui/gillu/desk/icon";
import { PageHeading } from "~/ui/gillu/desk/page-heading";
import { Panel } from "~/ui/gillu/desk/panel";

export default async function MerchantDashboardPage() {
  const merchant = await requireApprovedMerchant("/merchant/dashboard");
  const [profile, locations] = await Promise.all([
    getMerchantProfile(db, merchant),
    listPickupLocations(db, merchant),
  ]);
  const primary = locations.find((location) => location.isPrimary);
  const firstName = profile.contactName.trim().split(/\s+/)[0] ?? "";

  return (
    <>
      <PageHeading
        subtitle={`Namaste, ${firstName}. Here’s what’s happening at ${profile.storeName}.`}
        title="A good day starts here."
      />
      <section className="overview-welcome">
        <div>
          <p className="eyebrow">A LITTLE INDIA. A LOT OF HEART.</p>
          <h2 className="row wrap">
            {profile.storeName}
            <DeskBadge tone="delivered">Approved</DeskBadge>
          </h2>
          <p>Shop address: /shops/{profile.slug}</p>
          <p>
            Products, orders and sales appear here once product management is
            available.
          </p>
        </div>
        <Image
          alt="Warm festive arrangement with terracotta and marigolds"
          height={933}
          src="/gillu/hero.webp"
          width={1400}
        />
      </section>
      <div className="overview-grid">
        <Panel
          action={
            <Link className="text-button" href="/merchant/settings/shipping">
              Shipping settings <Icon name="arrow" />
            </Link>
          }
          title="Primary pickup location"
        >
          <p className="muted">Where couriers collect your parcels.</p>
          {primary ? (
            <div className="info-item dashboard-pickup">
              <strong>{primary.label}</strong>
              <p>
                {primary.line1}, {primary.city}, {primary.state}{" "}
                {primary.postalCode}
              </p>
            </div>
          ) : (
            <p>No pickup location yet.</p>
          )}
        </Panel>
        <Panel
          action={
            <Link className="text-button" href="/merchant/profile">
              Edit profile <Icon name="arrow" />
            </Link>
          }
          title="Shop profile"
        >
          <p className="muted">Contact details, addresses and registrations.</p>
          <p className="dashboard-pickup">
            {profile.contactName} · {profile.contactPhone}
          </p>
        </Panel>
      </div>
    </>
  );
}
