import Link from "next/link";

import { SiteIcon } from "~/ui/gillu/site/site-icons";

export function EmptyState() {
  return (
    <div className="empty-state">
      <SiteIcon className="empty-icon" name="squirrel" />
      <p>Nothing here yet — try fewer filters.</p>
      <Link className="text-link" href="/explore">
        Clear filters
      </Link>
    </div>
  );
}
