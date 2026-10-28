/** The first order number (parent design C4). */
export const ORDER_NUMBER_START = 1001;

export function orderNumber(n: number): string {
  return `GIL-${n}`;
}

/** 0 → A, 25 → Z, 26 → AA, like spreadsheet columns. */
export function partLetter(index: number): string {
  let letters = "";
  let n = index + 1;
  while (n > 0) {
    const rest = (n - 1) % 26;
    letters = String.fromCharCode(65 + rest) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

export function partNumber(order: string, index: number): string {
  return `${order}-${partLetter(index)}`;
}
