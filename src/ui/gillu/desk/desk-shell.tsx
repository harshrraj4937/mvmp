import type React from "react";

import type { MerchantStatus } from "~/modules/merchants/domain/status";

import { DeskIcons } from "./desk-icons";
import { DeskFrame, type DeskNavItem } from "./desk-nav.client";

const approvedNav = (newOrders: number): DeskNavItem[] => [
  { href: "/merchant/dashboard", icon: "grid", label: "Overview" },
  { badge: newOrders, href: "/merchant/orders", icon: "bag", label: "Orders" },
  { href: "/merchant/products", icon: "box", label: "Products" },
  { href: "/merchant/profile", icon: "store", label: "Store profile" },
  { href: "/merchant/settings/shipping", icon: "truck", label: "Shipping" },
];

const PENDING_NAV: DeskNavItem[] = [
  { href: "/merchant/onboarding", icon: "clock", label: "Shop status" },
  { href: "/merchant/profile", icon: "store", label: "Store profile" },
  { href: "/merchant/settings/shipping", icon: "truck", label: "Shipping" },
];

/**
 * Merchant desk chrome. Nav depends on the shop's status: only an APPROVED
 * shop gets Overview, Orders (with the count of new ones), Products and
 * search; a user without a shop gets the brand only. UX only — every page
 * and API route authorizes itself.
 */
export function DeskShell({
  children,
  merchant,
  newOrders = 0,
}: {
  children: React.ReactNode;
  merchant: null | { status: MerchantStatus; storeName: string };
  newOrders?: number;
}) {
  const approved = merchant?.status === "APPROVED";
  const items = merchant
    ? approved
      ? approvedNav(newOrders)
      : PENDING_NAV
    : [];
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <DeskIcons />
      <DeskFrame
        items={items}
        merchant={
          merchant
            ? {
                initials: storeInitials(merchant.storeName),
                storeName: merchant.storeName,
              }
            : null
        }
        search={approved}
      >
        {children}
      </DeskFrame>
    </>
  );
}

/** "Channapatna Toys" → "CT"; one-word names give their first two letters. */
export function storeInitials(storeName: string): string {
  const words = storeName.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length > 1
      ? `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`
      : (words[0] ?? "").slice(0, 2);
  return letters.toUpperCase() || "G";
}
