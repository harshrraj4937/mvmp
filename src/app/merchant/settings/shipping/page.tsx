import { db } from "~/db";
import { listPickupLocations, requireMerchant } from "~/modules/merchants";

import { ShippingSettings } from "./page.client";

export default async function MerchantShippingSettingsPage() {
  const merchant = await requireMerchant("/merchant/settings/shipping");
  const locations = await listPickupLocations(db, merchant);
  return <ShippingSettings locations={locations} />;
}
