import type React from "react";

/** Desk page heading (source `heading()`), without the demo eyebrow. */
export function PageHeading({
  action,
  eyebrow = "THE FESTIVE DESK",
  subtitle,
  title,
}: {
  action?: React.ReactNode;
  eyebrow?: string;
  subtitle: React.ReactNode;
  title: string;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action && <div className="page-actions">{action}</div>}
    </div>
  );
}
