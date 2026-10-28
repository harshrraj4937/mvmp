"use client";

import Form from "next/form";
import Link from "next/link";

import type { StorefrontQuery } from "~/modules/catalog/presentation/storefront-query";

interface Option {
  name: string;
  slug: string;
}

interface RegionOption extends Option {
  count: number;
}

/**
 * The explore filters. Menus and radios submit on change; the search box
 * submits on Enter or its button, so typing does not navigate per key.
 */
export function ExploreFilters({
  categories,
  query,
  regions,
}: {
  categories: Option[];
  query: StorefrontQuery;
  regions: RegionOption[];
}) {
  return (
    <Form
      action="/explore"
      className="explore-filters"
      onChange={(event) => {
        const field = event.target as unknown as HTMLInputElement;
        if (field.name !== "q") {
          event.currentTarget.requestSubmit();
        }
      }}
    >
      <div className="filter-field">
        <label htmlFor="q">Search</label>
        <div className="search-row">
          <input
            defaultValue={query.q ?? ""}
            id="q"
            maxLength={100}
            name="q"
            type="search"
          />
          <button className="button small" type="submit">
            Search
          </button>
        </div>
      </div>
      <div className="filter-field">
        <label htmlFor="region">Region</label>
        <select defaultValue={query.region ?? ""} id="region" name="region">
          <option value="">All regions</option>
          {regions.map((region) => (
            <option key={region.slug} value={region.slug}>
              {`${region.name} (${region.count})`}
            </option>
          ))}
        </select>
      </div>
      <div className="filter-field">
        <label htmlFor="category">Category</label>
        <select
          defaultValue={query.category ?? ""}
          id="category"
          name="category"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="made-fieldset">
        <legend>Made</legend>
        <label className="made-option">
          <input
            defaultChecked={!query.made}
            name="made"
            type="radio"
            value=""
          />
          All
        </label>
        <label className="made-option">
          <input
            defaultChecked={query.made === "handmade"}
            name="made"
            type="radio"
            value="handmade"
          />
          Handmade
        </label>
        <label className="made-option">
          <input
            defaultChecked={query.made === "homemade"}
            name="made"
            type="radio"
            value="homemade"
          />
          Homemade
        </label>
      </fieldset>
      <div className="filter-field">
        <label htmlFor="sort">Sort</label>
        <select defaultValue={query.sort} id="sort" name="sort">
          <option value="newest">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
      </div>
      <Link className="text-link" href="/explore">
        Clear all
      </Link>
    </Form>
  );
}
