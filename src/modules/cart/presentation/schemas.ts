import { z } from "zod";

import { MAX_LINE_QUANTITY } from "../domain/constants";

const quantity = z
  .number({ error: "Choose a quantity." })
  .int("Quantity must be a whole number.")
  .min(1, "Choose at least 1.")
  .max(
    MAX_LINE_QUANTITY,
    `You can order up to ${MAX_LINE_QUANTITY} of an item.`,
  );

export const cartAddSchema = z.object({
  quantity,
  variantId: z.string().trim().min(1, "Choose an item.").max(64),
});

/** Either a new quantity, or "I have seen the new price". */
export const cartUpdateSchema = z.union([
  z.object({ quantity }),
  z.object({ acknowledgePrice: z.literal(true) }),
]);
