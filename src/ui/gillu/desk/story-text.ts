import type { CompositionLabel } from "~/modules/catalog/domain/constants";

/**
 * Shared by server and client desk code. Kept out of a "use client" module:
 * a server component importing a value from one gets a client reference, not
 * the object, so lookups on it return undefined during server rendering.
 */
export const COMPOSITION_TEXT: Record<CompositionLabel, string> = {
  INGREDIENTS: "Ingredients",
  MATERIALS: "Materials",
};
