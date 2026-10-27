import { and, eq, inArray, type SQL, sql } from "drizzle-orm";

import type { Database } from "~/db";
import type { MerchantContext } from "~/modules/merchants";

import { merchantsTable, productsTable } from "~/db/schema";
import { ConflictError, ForbiddenError } from "~/platform/errors";

import {
  assertProductTransition,
  type ProductStatus,
  productStatusesAllowedBefore,
} from "../domain/product-status";
import { getProduct, type ProductDetail } from "./products";
import { loadOwnedProduct, type Transaction } from "./shared";

const adminHold = () =>
  new ConflictError(
    "admin_hold",
    "Gillu has unpublished this product. Contact support before publishing it again.",
  );

/** DRAFT, PUBLISHED or UNPUBLISHED → ARCHIVED (final for merchants). */
export async function archiveProduct(
  db: Database,
  ctx: MerchantContext,
  productId: string,
): Promise<ProductDetail> {
  await db.transaction((tx) => move(tx, ctx, productId, "ARCHIVED"));
  return getProduct(db, ctx, productId);
}

/**
 * DRAFT or UNPUBLISHED → PUBLISHED. The shop must be approved right now
 * (re-read, not taken from the session), the product must not be on an
 * admin hold, and nothing may be missing for publishing. The product row
 * is locked so the checks and the change see the same product.
 */
export async function publishProduct(
  db: Database,
  ctx: MerchantContext,
  productId: string,
): Promise<ProductDetail> {
  await db.transaction(async (tx) => {
    const [shop] = await tx
      .select({ status: merchantsTable.status })
      .from(merchantsTable)
      .where(eq(merchantsTable.id, ctx.merchantId));
    if (shop?.status !== "APPROVED") {
      throw new ForbiddenError(
        "Your shop must be approved before its products can be published.",
      );
    }
    const product = await loadOwnedProduct(tx, ctx, productId, { lock: true });
    if (product.adminHoldReason !== null) {
      throw adminHold();
    }
    assertProductTransition(product.status, "PUBLISHED");
    const { publishBlockers } = await getProduct(tx, ctx, productId);
    if (publishBlockers.length > 0) {
      throw new ConflictError(
        "not_publishable",
        "Add what is missing before publishing.",
        { missing: publishBlockers },
      );
    }
    // The first publish time is kept when a product is republished.
    await move(tx, ctx, productId, "PUBLISHED", {
      publishedAt: sql`coalesce(${productsTable.publishedAt}, now())`,
    });
  });
  return getProduct(db, ctx, productId);
}

/** PUBLISHED → UNPUBLISHED. */
export async function unpublishProduct(
  db: Database,
  ctx: MerchantContext,
  productId: string,
): Promise<ProductDetail> {
  await db.transaction((tx) => move(tx, ctx, productId, "UNPUBLISHED"));
  return getProduct(db, ctx, productId);
}

/**
 * Guarded status change: only rows still in a state that may move to `to`
 * are updated, so of two concurrent actions one wins and the other gets
 * 409 invalid_transition (or 404 for another shop's product).
 */
async function move(
  tx: Transaction,
  ctx: MerchantContext,
  productId: string,
  to: ProductStatus,
  set: Partial<Record<"publishedAt", SQL>> = {},
): Promise<void> {
  const updated = await tx
    .update(productsTable)
    .set({ status: to, ...set })
    .where(
      and(
        eq(productsTable.id, productId),
        eq(productsTable.merchantId, ctx.merchantId),
        inArray(productsTable.status, productStatusesAllowedBefore(to)),
      ),
    )
    .returning({ id: productsTable.id });
  if (updated.length === 0) {
    const product = await loadOwnedProduct(tx, ctx, productId);
    assertProductTransition(product.status, to);
    throw new ConflictError(
      "invalid_transition",
      "This product just changed. Reload and try again.",
    );
  }
}
