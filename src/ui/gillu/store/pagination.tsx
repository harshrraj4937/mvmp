import Link from "next/link";

import type { StorefrontQuery } from "~/modules/catalog/presentation/storefront-query";

/** The explore URL for `page`, keeping every other filter. */
export function exploreHref(query: StorefrontQuery, page: number): string {
  const params = new URLSearchParams();
  if (query.q) {
    params.set("q", query.q);
  }
  if (query.region) {
    params.set("region", query.region);
  }
  if (query.category) {
    params.set("category", query.category);
  }
  if (query.made) {
    params.set("made", query.made);
  }
  if (query.sort !== "newest") {
    params.set("sort", query.sort);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const text = params.toString();
  return text ? `/explore?${text}` : "/explore";
}

export function Pagination({
  page,
  pageSize,
  query,
  total,
}: {
  page: number;
  pageSize: number;
  query: StorefrontQuery;
  total: number;
}) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) {
    return null;
  }
  return (
    <nav aria-label="Pages" className="pagination">
      <ol>
        {Array.from({ length: pages }, (_, index) => index + 1).map(
          (number) => (
            <li key={number}>
              <Link
                aria-current={number === page ? "page" : undefined}
                href={exploreHref(query, number)}
              >
                {number}
              </Link>
            </li>
          ),
        )}
      </ol>
    </nav>
  );
}
