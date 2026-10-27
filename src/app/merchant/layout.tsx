import type { Metadata } from "next";
import type React from "react";

import "~/css/gillu-desk.css";
import { getCurrentMerchant } from "~/modules/merchants";
import { DeskShell } from "~/ui/gillu/desk/desk-shell";
import { dmSans, fraunces } from "~/ui/gillu/fonts";

export const metadata: Metadata = {
  icons: { icon: { type: "image/svg+xml", url: "/gillu/favicon.svg" } },
  title: "Gillu Merchant Desk",
};

/** Merchant desk shell. Each page authorizes itself; this is layout only. */
export default async function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const merchant = await getCurrentMerchant();
  return (
    <div
      className={`
        gillu-desk
        ${fraunces.variable}
        ${dmSans.variable}
      `}
    >
      <DeskShell merchant={merchant}>{children}</DeskShell>
    </div>
  );
}
