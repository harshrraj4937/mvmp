import type {
  ActorRole,
  FulfilmentStatus,
  MakerCancelReason,
} from "./statuses";

const STEPS: Record<ActorRole, [FulfilmentStatus, FulfilmentStatus][]> = {
  MERCHANT: [
    ["NEW", "ACKNOWLEDGED"],
    ["ACKNOWLEDGED", "PACKING"],
    ["PACKING", "READY_FOR_PICKUP"],
  ],
  SHOPPER: [],
  SYSTEM: [
    ["READY_FOR_PICKUP", "HANDED_TO_COURIER"],
    ["HANDED_TO_COURIER", "FULFILLED"],
  ],
};

/** Parts that can still be cancelled: anything not delivered or cancelled. */
const CANCELLABLE: readonly FulfilmentStatus[] = [
  "NEW",
  "ACKNOWLEDGED",
  "PACKING",
  "READY_FOR_PICKUP",
  "HANDED_TO_COURIER",
];

export function canTransition(
  from: FulfilmentStatus,
  to: FulfilmentStatus,
  actor: ActorRole,
): boolean {
  if (to === "CANCELED") {
    return actor !== "SYSTEM" && CANCELLABLE.includes(from);
  }
  return STEPS[actor].some(([a, b]) => a === from && b === to);
}

export function isOpen(status: FulfilmentStatus): boolean {
  return CANCELLABLE.includes(status);
}

/**
 * What happens to held stock when a part is cancelled: a maker who says the
 * pieces are gone (out of stock, damaged) writes them off; every other cancel
 * puts them back on sale.
 */
export function releaseMode(
  actor: ActorRole,
  reason: MakerCancelReason | null,
): "release" | "write_off" {
  return actor === "MERCHANT" &&
    (reason === "OUT_OF_STOCK" || reason === "DAMAGED")
    ? "write_off"
    : "release";
}
