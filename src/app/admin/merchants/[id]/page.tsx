import { notFound } from "next/navigation";

import type { PostalAddress } from "~/modules/merchants/presentation/schemas";

import { db } from "~/db";
import { requireAdmin } from "~/modules/identity";
import { getMerchantForAdmin } from "~/modules/merchants";
import { NotFoundError } from "~/platform/errors";
import { Badge } from "~/ui/primitives/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/primitives/card";

import { ReviewActions } from "./page.client";

const formatAddress = (address: PostalAddress) =>
  [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(", ");

export default async function AdminMerchantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;
  const merchant = await getMerchantForAdmin(db, admin, id).catch(
    (error: unknown) => {
      if (error instanceof NotFoundError) {
        notFound();
      }
      throw error;
    },
  );

  const rows: [string, null | string][] = [
    ["Shop URL", `/shops/${merchant.slug}`],
    ["Description", merchant.description],
    ["Owner account", merchant.ownerEmail],
    ["Contact", `${merchant.contactName} · ${merchant.contactPhone}`],
    ["Contact email", merchant.contactEmail],
    ["Business address", formatAddress(merchant.businessAddress)],
    ["Return address", formatAddress(merchant.returnAddress)],
    ["Logo", merchant.logoUrl],
    ["Submitted", merchant.submittedAt?.toLocaleString("en-IN") ?? null],
    ["Rejection reason", merchant.rejectionReason],
  ];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold">{merchant.storeName}</h2>
        <Badge variant="outline">{merchant.status}</Badge>
      </div>

      <ReviewActions merchantId={merchant.id} status={merchant.status} />

      <Card>
        <CardHeader>
          <CardTitle>Shop details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl
            className={`
              grid gap-2 text-sm
              sm:grid-cols-[12rem_1fr]
            `}
          >
            {rows.map(([label, value]) => (
              <div className="contents" key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Business registrations
            {!merchant.complianceVerified && (
              <Badge variant="secondary">Unverified</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Requirements per merchant type are not confirmed yet; treat these as
            declared by the merchant.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm">
          <p>GSTIN: {merchant.gstin ?? "—"}</p>
          <p>PAN: {merchant.pan ?? "—"}</p>
          <p>FSSAI: {merchant.fssaiLicense ?? "—"}</p>
          <p>Notes: {merchant.complianceNotes ?? "—"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pickup locations</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {merchant.pickupLocations.map((location) => (
            <p key={location.id}>
              <span className="font-medium">{location.label}</span>
              {location.isPrimary ? " (primary)" : ""}: {location.line1},{" "}
              {location.city}, {location.state} {location.postalCode} ·{" "}
              {location.contactName} {location.phone}
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
