import { createId } from "@paralleldrive/cuid2";

import type { Database } from "~/db";

import { categoriesTable } from "~/db/schema";
import { productCreateSchema } from "~/modules/catalog/presentation/schemas";
import { submitMerchant } from "~/modules/merchants/application/profile";
import { approveMerchant } from "~/modules/merchants/application/review";

import { testAdmin } from "../../support/merchant-fixtures";
import { seedMerchant, seedUser } from "./merchants";

/** Parsed product input, as a route handler would pass it to the service. */
export function productInput(
  overrides: Partial<Record<string, unknown>> = {},
  variant: Partial<Record<string, unknown>> = {},
) {
  return productCreateSchema.parse({
    categoryId: "cat_handmade_gifts",
    initialStock: 10,
    name: `Clay diya set ${createId().slice(0, 6)}`,
    variant: {
      heightMm: 50,
      lengthMm: 100,
      price: "399",
      sku: `SKU-${createId().slice(0, 10)}`,
      weightGrams: 500,
      widthMm: 100,
      ...variant,
    },
    ...overrides,
  });
}

/** A shop that went through submit and approval, ready to sell. */
export async function seedApprovedMerchant(
  db: Database,
  overrides: Parameters<typeof seedMerchant>[1] = {},
) {
  const merchant = await seedMerchant(db, overrides);
  await submitMerchant(db, merchant);
  await approveMerchant(
    db,
    testAdmin(await seedUser(db, "admin")),
    merchant.merchantId,
  );
  return { ...merchant, status: "APPROVED" as const };
}

/** An active category with a unique name; returns its id. */
export async function seedCategory(
  db: Database,
  name = `Category ${createId()}`,
): Promise<string> {
  const id = createId();
  await db
    .insert(categoriesTable)
    .values({ id, name, slug: id, sortOrder: 1000 });
  return id;
}
