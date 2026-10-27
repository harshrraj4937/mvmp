import { createId } from "@paralleldrive/cuid2";

import type { AdminActor } from "~/modules/identity";
import type { OnboardingInput } from "~/modules/merchants/presentation/schemas";

export function testAdmin(id: string): AdminActor {
  return {
    admin: true,
    email: `${id}@admin.gillu.test`,
    id,
    name: "Test Admin",
    role: "admin",
  };
}

export function uniqueSlug(prefix = "shop"): string {
  return `${prefix}-${createId().slice(0, 10)}`;
}

/** Raw onboarding payload as a browser would send it. */
export function validOnboarding(
  overrides: Partial<Record<keyof OnboardingInput, unknown>> = {},
): Record<string, unknown> {
  const address = {
    city: "Bengaluru",
    line1: "12 Chickpet Main Road",
    postalCode: "560 001",
    state: "Karnataka",
  };
  return {
    businessAddress: address,
    contactEmail: "asha@lakshmi-silks.test",
    contactName: "Asha Rao",
    contactPhone: "+91 98765 43210",
    description: "Handwoven Mysore silk sarees.",
    pickup: {
      address,
      contactName: "Asha Rao",
      label: "Warehouse",
      phone: "98765 43210",
    },
    returnAddress: address,
    slug: uniqueSlug(),
    storeName: "Lakshmi Silks",
    ...overrides,
  };
}
