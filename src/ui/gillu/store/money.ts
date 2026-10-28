/** Rupees for a paise amount: "₹1,299", or "₹1,299.50" when paise remain. */
export function formatRupees(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: paise % 100 ? 2 : 0,
    style: "currency",
  }).format(paise / 100);
}
