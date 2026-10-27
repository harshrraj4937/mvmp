import type { DeskIconName } from "./desk-icons";

/** `<use>` reference into the desk sprite ({@link DeskIcons}). */
export function Icon({
  className = "icon",
  name,
}: {
  className?: string;
  name: DeskIconName;
}) {
  return (
    <svg aria-hidden="true" className={className}>
      <use href={`#${name}`} />
    </svg>
  );
}
