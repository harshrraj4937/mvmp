/** The merchant desk's SVG symbol library (from gillu-merchant-html/index.html). */
export const DESK_ICON_NAMES = [
  "squirrel",
  "grid",
  "bag",
  "box",
  "star",
  "store",
  "settings",
  "search",
  "bell",
  "chevron",
  "down",
  "arrow",
  "download",
  "plus",
  "truck",
  "check",
  "check-circle",
  "clock",
  "alert",
  "play",
  "pause",
  "reset",
  "filter",
  "close",
  "menu",
  "help",
  "leaf",
  "edit",
  "mail",
] as const;

export type DeskIconName = (typeof DESK_ICON_NAMES)[number];

export function DeskIcons() {
  return (
    <svg
      aria-hidden="true"
      className="symbols"
      xmlns="http://www.w3.org/2000/svg"
    >
      <symbol id="squirrel" viewBox="0 0 64 60">
        <path
          d="M32 49c12 6 27-3 27-19 0-14-11-21-21-16-8 4-10 13-4 18 5 4 12 0 10-5-1-3-5-3-6-1"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="8"
        />
        <path
          d="M12 48c-1-6 1-11 6-15l-3-8 5-7 5 7c7 1 11 6 10 12l-1 12 7 4H12c-4 0-5-3 0-5Z"
          fill="currentColor"
        />
        <circle cx="25" cy="29" fill="#fff8ea" r="1.6" />
        <path
          d="m12 35 5 1"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="3"
        />
        <path
          d="M18 42h8"
          stroke="#fff8ea"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </symbol>
      <symbol id="grid" viewBox="0 0 24 24">
        <rect height="7" rx="1.5" width="7" x="3" y="3" />
        <rect height="7" rx="1.5" width="7" x="14" y="3" />
        <rect height="7" rx="1.5" width="7" x="3" y="14" />
        <rect height="7" rx="1.5" width="7" x="14" y="14" />
      </symbol>
      <symbol id="bag" viewBox="0 0 24 24">
        <path d="M5 8h14l1 13H4L5 8Z M8 8V6a4 4 0 0 1 8 0v2" />
      </symbol>
      <symbol id="box" viewBox="0 0 24 24">
        <path d="m3 7 9-5 9 5v10l-9 5-9-5V7Zm0 0 9 5 9-5M12 12v10M7 4.7l10 5.6" />
      </symbol>
      <symbol id="star" viewBox="0 0 24 24">
        <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
      </symbol>
      <symbol id="store" viewBox="0 0 24 24">
        <path d="M3 10 5 3h14l2 7M3 10c0 4 6 4 6 0 0 4 6 4 6 0 0 4 6 4 6 0M5 13v8h14v-8M9 21v-7h6v7M9 3v7M15 3v7" />
      </symbol>
      <symbol id="settings" viewBox="0 0 24 24">
        <path d="m10 3-1 3-3 1-3 3v4l3 3 3 1 1 3h4l1-3 3-1 3-3v-4l-3-3-3-1-1-3h-4Z" />
        <circle cx="12" cy="12" r="3" />
      </symbol>
      <symbol id="search" viewBox="0 0 24 24">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </symbol>
      <symbol id="bell" viewBox="0 0 24 24">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9 21h6" />
      </symbol>
      <symbol id="chevron" viewBox="0 0 24 24">
        <path d="m9 5 7 7-7 7" />
      </symbol>
      <symbol id="down" viewBox="0 0 24 24">
        <path d="m6 9 6 6 6-6" />
      </symbol>
      <symbol id="arrow" viewBox="0 0 24 24">
        <path d="M4 12h16m-6-6 6 6-6 6" />
      </symbol>
      <symbol id="download" viewBox="0 0 24 24">
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </symbol>
      <symbol id="plus" viewBox="0 0 24 24">
        <path d="M12 4v16M4 12h16" />
      </symbol>
      <symbol id="truck" viewBox="0 0 24 24">
        <path d="M3 5h12v12H3V5ZM15 9h4l3 4v4h-7" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
      </symbol>
      <symbol id="check" viewBox="0 0 24 24">
        <path d="m5 12 4 4L19 6" />
      </symbol>
      <symbol id="check-circle" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 5-6" />
      </symbol>
      <symbol id="clock" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </symbol>
      <symbol id="alert" viewBox="0 0 24 24">
        <path d="m12 3 10 18H2L12 3ZM12 9v5M12 17v.2" />
      </symbol>
      <symbol id="play" viewBox="0 0 24 24">
        <path d="m8 4 12 8-12 8V4Z" />
      </symbol>
      <symbol id="pause" viewBox="0 0 24 24">
        <path d="M8 4v16M16 4v16" />
      </symbol>
      <symbol id="reset" viewBox="0 0 24 24">
        <path d="M3 11a9 9 0 1 1 2 7M3 4v7h7" />
      </symbol>
      <symbol id="filter" viewBox="0 0 24 24">
        <path d="M4 7h16M4 17h16M8 4v6M16 14v6" />
      </symbol>
      <symbol id="close" viewBox="0 0 24 24">
        <path d="m6 6 12 12M18 6 6 18" />
      </symbol>
      <symbol id="menu" viewBox="0 0 24 24">
        <path d="M4 6h16M4 12h16M4 18h16" />
      </symbol>
      <symbol id="help" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 8.5a2.5 2.5 0 1 1 3.5 2.3c-1 .5-1 1.2-1 2.2M12 17v.2" />
      </symbol>
      <symbol id="leaf" viewBox="0 0 24 24">
        <path d="M20 3C8 2 3 7 5 15c3 8 15 4 15-12ZM4 21 16 8" />
      </symbol>
      <symbol id="edit" viewBox="0 0 24 24">
        <path d="m15 4 5 5M3 21l6-1L21 8l-5-5L4 15l-1 6Z" />
      </symbol>
      <symbol id="mail" viewBox="0 0 24 24">
        <rect height="14" rx="2" width="18" x="3" y="5" />
        <path d="m3 6 9 7 9-7" />
      </symbol>
    </svg>
  );
}
