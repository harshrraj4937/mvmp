"use client";

import Form from "next/form";

import { Icon } from "~/ui/gillu/desk/icon";

const STATUS_OPTIONS = [
  ["", "All products"],
  ["PUBLISHED", "Published"],
  ["DRAFT", "Drafts"],
  ["UNPUBLISHED", "Unpublished"],
  ["ARCHIVED", "Archived"],
] as const;

/** Search and status filter; a GET form, so filters live in the URL. */
export function CatalogToolbar({ q, status }: { q: string; status: string }) {
  return (
    <Form action="/merchant/products" className="catalog-toolbar">
      <label className="table-search">
        <Icon name="search" />
        <input
          aria-label="Search products"
          defaultValue={q}
          id="productSearch"
          name="q"
          placeholder="Search your catalog…"
          type="search"
        />
      </label>
      <select
        aria-label="Filter product status"
        className="filter-select"
        defaultValue={status}
        id="productStatus"
        name="status"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {STATUS_OPTIONS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </Form>
  );
}
