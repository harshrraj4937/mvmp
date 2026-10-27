import type React from "react";

import type { DeskIconName } from "./desk-icons";

import { Icon } from "./icon";

/** Desk empty state (source `emptyState()`). */
export function EmptyState({
  action,
  body,
  icon,
  title,
}: {
  action?: React.ReactNode;
  body: string;
  icon: DeskIconName;
  title: string;
}) {
  return (
    <div className="empty">
      <div className="empty-symbol">
        <Icon name={icon} />
      </div>
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </div>
  );
}
