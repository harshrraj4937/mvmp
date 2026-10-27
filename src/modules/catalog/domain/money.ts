/** Largest price a merchant can enter: ₹1,00,00,000 (one crore). */
const MAX_RUPEES = 10_000_000;

const RUPEES_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;

/**
 * A price typed by a merchant ("₹1,299.50", "399", "1,00,000") in paise, or
 * null when it is not a positive amount with at most two decimals. Integer
 * string arithmetic only, so "0.29" is exactly 29 paise.
 */
export function parseRupees(input: string): null | number {
  const cleaned = input.replace(/₹/g, "").replace(/,/g, "").trim();
  const match = RUPEES_PATTERN.exec(cleaned);
  if (!match) {
    return null;
  }
  const [, whole = "", fraction = ""] = match;
  if (whole.length > String(MAX_RUPEES).length) {
    return null;
  }
  const paise =
    Number.parseInt(whole, 10) * 100 +
    Number.parseInt(fraction.padEnd(2, "0") || "0", 10);
  if (paise <= 0 || paise > MAX_RUPEES * 100) {
    return null;
  }
  return paise;
}

const whole = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
  style: "currency",
});

const withPaise = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});

/** "₹1,299.50", "₹399", "₹1,00,000": decimals only when there are paise. */
export function formatPaise(paise: number): string {
  const format = paise % 100 === 0 ? whole : withPaise;
  return format.format(paise / 100);
}
