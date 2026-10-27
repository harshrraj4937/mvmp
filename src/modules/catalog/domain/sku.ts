const SKU_PATTERN = /^[A-Z0-9_-]{1,40}$/;

/** A merchant's SKU, trimmed and uppercased, or null when not 1–40 of A–Z 0–9 _ -. */
export function normalizeSku(input: string): null | string {
  const sku = input.trim().toUpperCase();
  return SKU_PATTERN.test(sku) ? sku : null;
}
