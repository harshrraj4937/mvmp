export type SiteIconName =
  | "arrow"
  | "arrow-up"
  | "flower"
  | "gift"
  | "hands"
  | "leaf"
  | "squirrel";

/** `<use>` reference into {@link SiteIcons}. */
export function SiteIcon({
  className,
  name,
}: {
  className?: string;
  name: SiteIconName;
}) {
  return (
    <svg aria-hidden="true" className={className}>
      <use href={`#${name}`} />
    </svg>
  );
}

/** The landing page's SVG symbol library (from index.html @ eacfe57). */
export function SiteIcons() {
  return (
    <svg
      aria-hidden="true"
      className="svg-library"
      xmlns="http://www.w3.org/2000/svg"
    >
      <symbol id="arrow" viewBox="0 0 24 24">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </symbol>
      <symbol id="arrow-up" viewBox="0 0 24 24">
        <path d="M6 18 18 6M6 6h12v12" />
      </symbol>
      <symbol id="flower" viewBox="0 0 40 40">
        <g fill="currentColor">
          <ellipse cx="20" cy="10" rx="5" ry="9" />
          <ellipse cx="20" cy="30" rx="5" ry="9" />
          <ellipse cx="10" cy="20" rx="9" ry="5" />
          <ellipse cx="30" cy="20" rx="9" ry="5" />
          <ellipse
            cx="13"
            cy="13"
            rx="5"
            ry="9"
            transform="rotate(-45 13 13)"
          />
          <ellipse
            cx="27"
            cy="27"
            rx="5"
            ry="9"
            transform="rotate(-45 27 27)"
          />
          <ellipse cx="27" cy="13" rx="5" ry="9" transform="rotate(45 27 13)" />
          <ellipse cx="13" cy="27" rx="5" ry="9" transform="rotate(45 13 27)" />
        </g>
        <circle cx="20" cy="20" fill="#f8f0e1" r="5" />
      </symbol>
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
      <symbol id="leaf" viewBox="0 0 32 32">
        <path d="M26 5C10 3 3 10 7 20c4 10 19 4 19-15Z M6 27 21 11" />
      </symbol>
      <symbol id="gift" viewBox="0 0 32 32">
        <path d="M5 13h22v6H5zM8 19v10h16V19M16 13v16M16 13c-13 0-9-13-3-7l3 7Zm0 0c13 0 9-13 3-7l-3 7Z" />
      </symbol>
      <symbol id="hands" viewBox="0 0 32 32">
        <path d="m3 18 5-3 7 6 7-6 7 3M3 26l7-1 5-4M29 26l-7-1-7-4M10 10c-4-4 3-8 6-3 3-5 10-1 6 3l-6 5Z" />
      </symbol>
    </svg>
  );
}
