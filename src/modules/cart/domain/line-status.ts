export interface LineFacts {
  available: number;
  currentPricePaise: number;
  purchasable: boolean;
  quantity: number;
  seenPricePaise: number;
}

export type LineStatus =
  | "ok"
  | "price_changed"
  | "short"
  | "sold_out"
  | "unavailable";

/**
 * What a line says to the shopper, most blocking first: the product is off
 * sale, then no stock, then not enough stock, then the price moved.
 */
export function lineStatus(line: LineFacts): LineStatus {
  if (!line.purchasable) {
    return "unavailable";
  }
  if (line.available === 0) {
    return "sold_out";
  }
  if (line.quantity > line.available) {
    return "short";
  }
  if (line.seenPricePaise !== line.currentPricePaise) {
    return "price_changed";
  }
  return "ok";
}
