import Image from "next/image";
import Link from "next/link";

import { db } from "~/db";
import { catalogCounts } from "~/modules/catalog";
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
  const [profile, locations, counts] = await Promise.all([
    getMerchantProfile(db, merchant),
    listPickupLocations(db, merchant),
    catalogCounts(db, merchant),
  ]);
  const metrics = [
    ["Published", counts.byStatus.PUBLISHED, "Live in your shop", "PUBLISHED"],
    ["Drafts", counts.byStatus.DRAFT, "Waiting for a final touch", "DRAFT"],
    ["Out of stock", counts.outOfStock, "Nothing left to sell", ""],
    ["Low stock", counts.lowStock, "A variant has 5 or fewer", ""],
  ] as const;
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
            {counts.byStatus.PUBLISHED === 1
              ? "1 product is live in your shop."
              : `${counts.byStatus.PUBLISHED} products are live in your shop.`}
          </p>
          <Link className="button" href="/merchant/products">
            <Icon name="box" />
            Manage products
          </Link>
        </div>
        <Image
          alt="Warm festive arrangement with terracotta and marigolds"
          height={933}
          src="/gillu/hero.webp"
          width={1400}
        />
      </section>
      <section aria-label="Your catalog" className="metrics overview-metrics">
        {metrics.map(([label, value, note, status]) => (
          <Link
            className="metric"
            href={
              status
                ? `/merchant/products?status=${status}`
                : "/merchant/products"
            }
            key={label}
          >
            <span className="metric-top">
              {label}
              <Icon name="arrow" />
            </span>
            <strong className="metric-value">{value}</strong>
            <span className="metric-note">{note}</span>
          </Link>
        ))}
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
