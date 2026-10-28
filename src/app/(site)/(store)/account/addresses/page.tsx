import type { Metadata } from "next";

import Link from "next/link";

import { db } from "~/db";
import { requireSession } from "~/modules/identity";
import { listAddresses } from "~/modules/orders";
import { AddressList } from "~/ui/gillu/store/address-list.client";

export const metadata: Metadata = {
  robots: { index: false },
  title: "Your addresses · Gillu",
};

export default async function AddressesPage() {
  const user = await requireSession("/account/addresses");
  const addresses = await listAddresses(db, user.id);
  return (
    <div className="checkout-page account-page">
      <h1>Your addresses</h1>
      <p>
        <Link className="text-link" href="/orders">
          My orders
        </Link>
      </p>
      <AddressList addresses={addresses} />
    </div>
  );
}
