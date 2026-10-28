import type { FulfilmentStatus, OrderStatus } from "./statuses";

/** The order's status follows its parts (spec §4.2). */
export function deriveOrderStatus(parts: FulfilmentStatus[]): OrderStatus {
  const live = parts.filter((status) => status !== "CANCELED");
  if (live.length === 0) {
    return "CANCELED";
  }
  if (live.every((status) => status === "FULFILLED")) {
    return "COMPLETED";
  }
  if (live.some((status) => status === "FULFILLED")) {
    return "PARTIALLY_FULFILLED";
  }
  if (live.some((status) => status !== "NEW")) {
    return "PROCESSING";
  }
  return "CONFIRMED";
}
