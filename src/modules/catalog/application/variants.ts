import { and, eq, max } from "drizzle-orm";

import type { Database } from "~/db";
import type { MerchantContext } from "~/modules/merchants";

import { productVariantsTable } from "~/db/schema";
import { ConflictError, ValidationError } from "~/platform/errors";

import {
  MRP_BELOW_PRICE,
  type VariantCreate,
  type VariantPatch,
} from "../presentation/schemas";
import { getProduct, type ProductDetail } from "./products";
import {
  archivedProduct,
  insertVariant,
  loadOwnedProduct,
  loadOwnedVariant,
  loadVariantView,
  rethrowSkuTaken,
  type Transaction,
  type VariantView,
} from "./shared";

const labelRequired = () =>
  new ConflictError(
    "label_required",
    "Give every variant a label, like 250 g or Large, when a product has more than one.",
  );

/** Adds a labelled variant with its opening stock. */
export async function addVariant(
  db: Database,
  ctx: MerchantContext,
  productId: string,
  input: VariantCreate,
): Promise<ProductDetail> {
  try {
    await db.transaction(async (tx) => {
      const product = await loadOwnedProduct(tx, ctx, productId, {
        lock: true,
      });
      if (product.status === "ARCHIVED") {
        throw archivedProduct();
      }
      const siblings = await siblingVariants(tx, productId);
      if (siblings.some((variant) => variant.isActive && !variant.label)) {
        throw labelRequired();
      }
      const [last] = await tx
        .select({ sortOrder: max(productVariantsTable.sortOrder) })
        .from(productVariantsTable)
        .where(eq(productVariantsTable.productId, productId));
      await insertVariant(tx, ctx, productId, input, {
        initialStock: input.initialStock,
        label: input.label,
        sortOrder: (last?.sortOrder ?? 0) + 1,
      });
    });
  } catch (error) {
    rethrowSkuTaken(error);
  }
  return getProduct(db, ctx, productId);
}

/**
 * Edits a variant. Price and MRP are checked together (price ≤ MRP), a
 * published product keeps at least one active variant, and a product with
 * several active variants needs a label on each.
 */
export async function updateVariant(
  db: Database,
  ctx: MerchantContext,
  variantId: string,
  patch: VariantPatch,
): Promise<VariantView> {
  try {
    await db.transaction(async (tx) => {
      const current = await loadOwnedVariant(tx, ctx, variantId);
      const product = await loadOwnedProduct(tx, ctx, current.productId, {
        lock: true,
      });
      if (product.status === "ARCHIVED") {
        throw archivedProduct();
      }

      const price = patch.price ?? current.pricePaise;
      const mrp =
        patch.mrp === undefined ? current.declaredMrpPaise : patch.mrp;
      if (mrp !== null && mrp < price) {
        throw new ValidationError(undefined, { mrp: [MRP_BELOW_PRICE] });
      }

      const next = {
        isActive: patch.isActive ?? current.isActive,
        label: patch.label ?? current.label,
      };
      const others = (await siblingVariants(tx, product.id)).filter(
        (variant) => variant.id !== variantId,
      );
      const activeAfter = [
        ...others.filter((variant) => variant.isActive),
        ...(next.isActive ? [next] : []),
      ];
      if (product.status === "PUBLISHED" && activeAfter.length === 0) {
        throw new ConflictError(
          "last_variant",
          "A published product needs at least one active variant. Unpublish it first.",
        );
      }
      if (
        activeAfter.length > 1 &&
        activeAfter.some((variant) => !variant.label)
      ) {
        throw labelRequired();
      }

      await tx
        .update(productVariantsTable)
        .set({
          declaredMrpPaise: mrp,
          heightMm: patch.heightMm,
          isActive: patch.isActive,
          label: patch.label,
          lengthMm: patch.lengthMm,
          pricePaise: patch.price,
          sku: patch.sku,
          weightGrams: patch.weightGrams,
          widthMm: patch.widthMm,
        })
        .where(
          and(
            eq(productVariantsTable.id, variantId),
            eq(productVariantsTable.merchantId, ctx.merchantId),
          ),
        );
    });
  } catch (error) {
    rethrowSkuTaken(error);
  }
  return loadVariantView(db, variantId);
}

async function siblingVariants(tx: Transaction, productId: string) {
  return tx
    .select({
      id: productVariantsTable.id,
      isActive: productVariantsTable.isActive,
      label: productVariantsTable.label,
    })
    .from(productVariantsTable)
    .where(eq(productVariantsTable.productId, productId));
}
