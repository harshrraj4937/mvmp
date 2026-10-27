import Link from "next/link";

import { db } from "~/db";
import {
  getMerchantProfile,
  listPickupLocations,
  requireApprovedMerchant,
} from "~/modules/merchants";
import { Badge } from "~/ui/primitives/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/primitives/card";

export default async function MerchantDashboardPage() {
  const merchant = await requireApprovedMerchant("/merchant/dashboard");
  const [profile, locations] = await Promise.all([
    getMerchantProfile(db, merchant),
    listPickupLocations(db, merchant),
  ]);
  const primary = locations.find((location) => location.isPrimary);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">{profile.storeName}</h1>
        <Badge>Approved</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Shop address: /shops/{profile.slug}
      </p>

      <div
        className={`
          grid gap-4
          md:grid-cols-2
        `}
      >
        <Card>
          <CardHeader>
            <CardTitle>Primary pickup location</CardTitle>
            <CardDescription>
              Where couriers collect your parcels.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            {primary ? (
              <>
                <p className="font-medium">{primary.label}</p>
                <p>
                  {primary.line1}, {primary.city}, {primary.state}{" "}
                  {primary.postalCode}
                </p>
              </>
            ) : (
              <p>No pickup location yet.</p>
            )}
            <Link
              className="mt-2 inline-block underline"
              href="/merchant/settings/shipping"
            >
              Shipping settings
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Shop profile</CardTitle>
            <CardDescription>
              Contact details, addresses and registrations.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <p>
              {profile.contactName} · {profile.contactPhone}
            </p>
            <Link
              className="mt-2 inline-block underline"
              href="/merchant/profile"
            >
              Edit profile
            </Link>
          </CardContent>
        </Card>
      </div>
      <p className="text-sm text-muted-foreground">
        Products, orders and sales appear here once product management is
        available.
      </p>
    </div>
  );
}
