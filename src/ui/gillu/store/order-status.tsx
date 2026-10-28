import type { FulfilmentStatus } from "~/modules/orders/domain/statuses";

import { SHOPPER_STATUS_TEXT } from "~/modules/orders/domain/labels";

/** A parcel's status in the shopper's words. */
export function OrderStatus({ status }: { status: FulfilmentStatus }) {
  return (
    <span className="order-status" data-status={status}>
      {SHOPPER_STATUS_TEXT[status]}
    </span>
  );
}
