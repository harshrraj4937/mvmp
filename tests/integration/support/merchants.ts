import { createId } from "@paralleldrive/cuid2";

import type { Database } from "~/db";

import { userTable } from "~/db/schema";
import {
  type OnboardingInput,
  onboardingSchema,
} from "~/modules/merchants/presentation/schemas";

import { validOnboarding } from "../../support/merchant-fixtures";

/** Parsed onboarding input, as a route handler would pass it to a service. */
export function onboarding(
  overrides: Parameters<typeof validOnboarding>[0] = {},
): OnboardingInput {
  return onboardingSchema.parse(validOnboarding(overrides));
}

/** Registers a shop for a new user and returns its context. */
export async function seedMerchant(
  db: Database,
  overrides: Parameters<typeof validOnboarding>[0] = {},
) {
  const { registerMerchant } = await import(
    "~/modules/merchants/application/register"
  );
  return registerMerchant(
    db,
    { id: await seedUser(db) },
    onboarding(overrides),
  );
}

export async function seedUser(db: Database, role: null | string = null) {
  const id = createId();
  await db.insert(userTable).values({
    email: `${id}@merchants.gillu.test`,
    id,
    name: "Merchant Test",
    role,
  });
  return id;
}
