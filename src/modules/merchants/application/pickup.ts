import type { merchantPickupLocationsTable } from "~/db/schema";

export interface PickupLocation {
  city: string;
  contactName: string;
  id: string;
  isPrimary: boolean;
  label: string;
  line1: string;
  line2: null | string;
  phone: string;
  postalCode: string;
  state: string;
}

export function toPickupLocation(
  row: typeof merchantPickupLocationsTable.$inferSelect,
): PickupLocation {
  const {
    city,
    contactName,
    id,
    isPrimary,
    label,
    line1,
    line2,
    phone,
    postalCode,
    state,
  } = row;
  return {
    city,
    contactName,
    id,
    isPrimary,
    label,
    line1,
    line2,
    phone,
    postalCode,
    state,
  };
}
