import type { Metadata } from "next";

import { db } from "~/db";
import {
  listActiveCategories,
  parseStorefrontSearchParams,
  searchStorefront,
} from "~/modules/catalog";
import { EmptyState } from "~/ui/gillu/store/empty";
import { ExploreFilters } from "~/ui/gillu/store/explore-filters.client";
import { Pagination } from "~/ui/gillu/store/pagination";
import { StoreCard } from "~/ui/gillu/store/store-card";

export const metadata: Metadata = { title: "Explore · Gillu" };

export default async function ExplorePage({
  searchParams,
}: PageProps<"/explore">) {
  const query = parseStorefrontSearchParams(await searchParams);
  const [result, categories] = await Promise.all([
    searchStorefront(db, query),
    listActiveCategories(db),
  ]);

  return (
    <div className="explore">
      <header className="explore-head">
        <h1>Explore Gillu</h1>
        <p className="muted">
          {result.total} {result.total === 1 ? "find" : "finds"}
        </p>
      </header>
      <div className="explore-layout">
        <ExploreFilters
          categories={categories.map((category) => ({
            name: category.name,
            slug: category.slug,
          }))}
          query={query}
          regions={result.regionCounts.map((region) => ({
            count: region.count,
            name: region.name,
            slug: region.slug,
          }))}
        />
        <section aria-label="Results">
          {result.items.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="store-grid">
              {result.items.map((card) => (
                <li key={card.productId}>
                  <StoreCard card={card} />
                </li>
              ))}
            </ul>
          )}
          <Pagination
            page={result.page}
            pageSize={result.pageSize}
            query={query}
            total={result.total}
          />
        </section>
      </div>
    </div>
  );
}
