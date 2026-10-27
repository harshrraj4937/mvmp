"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { MerchantProfile } from "~/modules/merchants/application/profile";

import { fieldErrors, sendJson } from "~/lib/api-client";
import { Badge } from "~/ui/primitives/badge";
import { Button } from "~/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/primitives/card";

import {
  type AddressValues,
  ProfileFields,
  type ProfileValues,
} from "../merchant-fields.client";

const toAddress = (
  address: MerchantProfile["businessAddress"],
): AddressValues => ({
  ...address,
  line2: address.line2 ?? "",
});

export function ProfileForm({
  locked,
  profile,
  readOnly,
}: {
  locked: string[];
  profile: MerchantProfile;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ProfileValues>(() => ({
    businessAddress: toAddress(profile.businessAddress),
    complianceNotes: profile.complianceNotes ?? "",
    contactEmail: profile.contactEmail,
    contactName: profile.contactName,
    contactPhone: profile.contactPhone,
    description: profile.description ?? "",
    fssaiLicense: profile.fssaiLicense ?? "",
    gstin: profile.gstin ?? "",
    logoUrl: profile.logoUrl ?? "",
    pan: profile.pan ?? "",
    returnAddress: toAddress(profile.returnAddress),
    slug: profile.slug,
    storeName: profile.storeName,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ error: boolean; text: string }>();
  const [saving, setSaving] = useState(false);
  const underReview = profile.status === "SUBMITTED";

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(undefined);
    const lockedSet = new Set(locked);
    // Locked fields are left out; the server refuses changes to them anyway.
    const patch = Object.fromEntries(
      Object.entries(values).filter(([key]) => !lockedSet.has(key)),
    );
    const result = await sendJson("/api/v1/merchant/profile", "PATCH", patch);
    setSaving(false);
    if (result.error) {
      setErrors(fieldErrors(result.error));
      setMessage({ error: true, text: result.error.message });
      return;
    }
    setErrors({});
    setMessage({ error: false, text: "Profile saved" });
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shop profile</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{profile.status}</Badge>
          {!profile.complianceVerified && (
            <Badge
              title="Gillu has not confirmed these registrations yet"
              variant="secondary"
            >
              Unverified
            </Badge>
          )}
          {underReview && "Your shop is under review and cannot be edited."}
          {readOnly && "Only the shop owner can change the profile."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-8" noValidate onSubmit={save}>
          <ProfileFields
            errors={errors}
            locked={new Set(locked)}
            onChange={setValues}
            readOnly={readOnly || underReview}
            showReturnAddress
            values={values}
          />
          {message && (
            <p
              className={
                message.error
                  ? "text-sm font-medium text-destructive"
                  : "text-sm font-medium text-green-700"
              }
              role={message.error ? "alert" : "status"}
            >
              {message.text}
            </p>
          )}
          {!readOnly && !underReview && (
            <Button disabled={saving} type="submit">
              {saving ? "Saving…" : "Save profile"}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
