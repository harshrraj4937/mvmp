import type React from "react";

const TONE_CLASS = {
  danger: "cancelled",
  delivered: "delivered",
  neutral: "neutral",
  warning: "new",
} as const;

/** Status badge in the desk palette (source `.badge.<status>` colours). */
export function DeskBadge({
  children,
  title,
  tone,
}: {
  children: React.ReactNode;
  title?: string;
  tone: keyof typeof TONE_CLASS;
}) {
  return (
    <span
      className={`
        badge
        ${TONE_CLASS[tone]}
      `}
      title={title}
    >
      {children}
    </span>
  );
}
