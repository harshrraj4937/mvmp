import Link from "next/link";
import { z } from "zod";

import { db } from "~/db";
import { listProductsForAdmin } from "~/modules/catalog";
import { PRODUCT_STATUSES } from "~/modules/catalog/domain/product-status";
import { requireAdmin } from "~/modules/identity";

import { ProductModeration } from "./page.client";

const tabs = [
  undefined,
  ...PRODUCT_STATUSES.filter((status) => status !== "PENDING_APPROVAL"),
];

export default async function AdminProductsPage({
  searchParams,
}: PageProps<"/admin/products">) {
  // Authorize in the page itself: the admin layout does not stop this
  // segment from rendering.
  const admin = await requireAdmin();
  const { status: raw } = await searchParams;
  const parsed = z.enum(PRODUCT_STATUSES).safeParse(raw);
  const status = parsed.success ? parsed.data : undefined;
  const products = await listProductsForAdmin(db, admin, { status });

  return (
    <div className="grid gap-4">
      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            aria-current={tab === status ? "page" : undefined}
            className={
              tab === status
                ? `
                  rounded-md bg-primary px-3 py-1 text-sm
                  text-primary-foreground
                `
                : "rounded-md border px-3 py-1 text-sm"
            }
            href={tab ? `/admin/products?status=${tab}` : "/admin/products"}
            key={tab ?? "ALL"}
          >
            {tab ? tab.charAt(0) + tab.slice(1).toLowerCase() : "All"}
          </Link>
        ))}
      </nav>
      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">No products here.</p>
      ) : (
        <ProductModeration
          products={products.map((product) => ({
            adminHoldReason: product.adminHoldReason,
            id: product.id,
            name: product.name,
            priceFromPaise: product.priceFromPaise,
            status: product.status,
            storeName: product.storeName,
          }))}
        />
      )}
    </div>
  );
}
