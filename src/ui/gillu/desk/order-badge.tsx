import type { FulfilmentStatus } from "~/modules/orders/domain/statuses";

import { MAKER_STATUS_TEXT } from "~/modules/orders/domain/labels";

import { DeskBadge } from "./badge";

const TONE: Record<
  FulfilmentStatus,
  "danger" | "delivered" | "neutral" | "warning"
> = {
  ACKNOWLEDGED: "neutral",
  CANCELED: "danger",
  FULFILLED: "delivered",
  HANDED_TO_COURIER: "delivered",
  NEW: "warning",
  PACKING: "neutral",
  READY_FOR_PICKUP: "delivered",
};

/** A part's status in the maker's words. */
export function OrderBadge({ status }: { status: FulfilmentStatus }) {
  return <DeskBadge tone={TONE[status]}>{MAKER_STATUS_TEXT[status]}</DeskBadge>;
}
