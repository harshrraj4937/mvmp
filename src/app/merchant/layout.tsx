import type React from "react";

import Link from "next/link";

/** Merchant area shell. Each page authorizes itself; this is layout only. */
export default function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="container mx-auto grid max-w-4xl gap-6 px-4 py-10">
      <nav
        aria-label="Merchant"
        className="flex flex-wrap gap-4 text-sm text-muted-foreground"
      >
        <Link href="/merchant/dashboard">Dashboard</Link>
        <Link href="/merchant/profile">Profile</Link>
        <Link href="/merchant/settings/shipping">Shipping</Link>
      </nav>
      {children}
    </div>
  );
}
