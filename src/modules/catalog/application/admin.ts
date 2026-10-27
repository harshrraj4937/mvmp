import { and, eq, isNotNull } from "drizzle-orm";

import type { Database } from "~/db";
import type { AdminActor } from "~/modules/identity";

import { productsTable } from "~/db/schema";
import { ConflictError } from "~/platform/errors";

import type { Hold } from "../presentation/schemas";

import {
  assertProductTransition,
  type ProductStatus,
} from "../domain/product-status";
import { type ShopProductSummary, summaries } from "./products";
import { productNotFound } from "./shared";

/**
 * Unpublishes a PUBLISHED product and records why, by whom and when. The
 * merchant sees the reason and cannot publish until an admin releases it.
 */
export async function holdProduct(
  db: Database,
  admin: AdminActor,
  productId: string,
  hold: Hold,
): Promise<ShopProductSummary> {
  const updated = await db
    .update(productsTable)
    .set({
      adminHoldAt: new Date(),
      adminHoldBy: admin.id,
      adminHoldReason: hold.reason,
      status: "UNPUBLISHED",
    })
    .where(
      and(
        eq(productsTable.id, productId),
        eq(productsTable.status, "PUBLISHED"),
      ),
    )
    .returning({ id: productsTable.id });
  if (updated.length === 0) {
    const status = await currentStatus(db, productId);
    assertProductTransition(status, "UNPUBLISHED");
    // UNPUBLISHED → UNPUBLISHED passes the table above but is not a hold.
    throw new ConflictError(
      "invalid_transition",
      "Only a published product can be unpublished.",
    );
  }
  return summary(db, productId);
}

/** Every shop's products (archived ones only on request), newest change first. */
export async function listProductsForAdmin(
  db: Database,
  // Proof the caller is an admin; not otherwise needed.

  _admin: AdminActor,
  filter: { status?: ProductStatus },
): Promise<ShopProductSummary[]> {
  return summaries(db, [
    filter.status ? eq(productsTable.status, filter.status) : undefined,
  ]);
}

/** Clears a hold; the product stays UNPUBLISHED until the merchant publishes. */
export async function releaseProduct(
  db: Database,

  _admin: AdminActor,
  productId: string,
): Promise<ShopProductSummary> {
  const updated = await db
    .update(productsTable)
    .set({ adminHoldAt: null, adminHoldBy: null, adminHoldReason: null })
    .where(
      and(
        eq(productsTable.id, productId),
        isNotNull(productsTable.adminHoldReason),
      ),
    )
    .returning({ id: productsTable.id });
  if (updated.length === 0) {
    await currentStatus(db, productId);
    throw new ConflictError("no_hold", "This product is not on hold.");
  }
  return summary(db, productId);
}

async function currentStatus(
  db: Database,
  productId: string,
): Promise<ProductStatus> {
  const [product] = await db
    .select({ status: productsTable.status })
    .from(productsTable)
    .where(eq(productsTable.id, productId));
  if (!product) {
    throw productNotFound();
  }
  return product.status;
}

async function summary(
  db: Database,
  productId: string,
): Promise<ShopProductSummary> {
  const [product] = await summaries(db, [eq(productsTable.id, productId)]);
  if (!product) {
    throw productNotFound();
  }
  return product;
}
