"use client";

import Image from "next/image";
import Link from "next/link";

import type { StorefrontCard } from "~/modules/catalog/application/storefront";
import type { StateSlug } from "~/modules/catalog/domain/indian-states";

import { StoreCard } from "../store/store-card";
import {
  COLLECTION_FILTERS,
  PRODUCT_ORDER,
  type ProductPreviewKey,
  productPreviews,
  REGION_ORDER,
  REGION_STATE,
  regions,
} from "./content";
import { SiteIcon } from "./site-icons";
import { useSite } from "./site-shell.client";

const COUNT_WORDS = ["no", "one", "two", "three"];

export interface Highlights {
  categories: { name: string; slug: string }[];
  /** Newest purchasable products, up to three. Empty until a shop sells. */
  newest: StorefrontCard[];
  /** States with purchasable products. */
  regions: StateSlug[];
}

/**
 * "The Gillu edit". With live products it shows real cards and category
 * links; until then it shows the illustrative previews. Region cards link
 * to explore where a region has products and say "Coming soon" elsewhere.
 */
export function Collection({ highlights }: { highlights: Highlights }) {
  const { filter, openDialog, setFilter } = useSite();
  const live = highlights.newest.length > 0;
  const visible = PRODUCT_ORDER.filter(
    (key) => filter === "all" || productPreviews[key].filter === filter,
  );
  const status = `Showing ${
    filter === "all" ? "all three" : COUNT_WORDS[visible.length]
  } collection ${visible.length === 1 ? "preview" : "previews"}.`;

  return (
    <section
      aria-labelledby="collection-title"
      className="collection section container"
      id="discover"
    >
      <div className="section-heading">
        <div>
          {!live && <p className="eyebrow">THE GILLU EDIT</p>}
          <h2 id="collection-title">
            Little finds.
            <br className="mobile-only" /> <em>Lovely stories.</em>
          </h2>
        </div>
        <p>
          For the festive table, the thoughtful gift,
          <br />
          and the little corners you call home.
        </p>
      </div>

      {live ? (
        <div className="collection-toolbar">
          <nav aria-label="Browse categories" className="filter-buttons">
            {highlights.categories.map((category) => (
              <Link
                className="filter"
                href={`/explore?category=${category.slug}`}
                key={category.slug}
              >
                {category.name}
              </Link>
            ))}
          </nav>
          <Link className="text-link" href="/explore">
            Explore everything
          </Link>
        </div>
      ) : (
        <div className="collection-toolbar">
          <div
            aria-label="Filter collections"
            className="filter-buttons"
            role="group"
          >
            {COLLECTION_FILTERS.map(({ key, label }) => (
              <button
                aria-pressed={filter === key}
                className={`
                  filter
                  ${filter === key ? "active" : ""}
                `}
                key={key}
                onClick={() => {
                  setFilter(key);
                }}
                type="button"
              >
                {label}
                {key === "all" && <span>03</span>}
              </button>
            ))}
          </div>
          <span className="preview-label">
            <span /> A taste of what&apos;s to come
          </span>
        </div>
      )}

      <div className="product-grid" id="product-grid">
        {live
          ? highlights.newest.map((card) => (
              <StoreCard card={card} key={card.productId} />
            ))
          : PRODUCT_ORDER.map((key) => {
              const item = productPreviews[key];
              const show = () => {
                openDialog(<ProductDialog previewKey={key} />);
              };
              return (
                <article
                  className="product-card"
                  hidden={!visible.includes(key)}
                  key={key}
                >
                  <button
                    aria-label={`Explore ${item.title.replace("&", "and")}`}
                    className="product-image"
                    onClick={show}
                    type="button"
                  >
                    <Image
                      alt={item.cardAlt}
                      height={720}
                      src={item.image}
                      width={720}
                    />
                    <span className="product-tag">{item.tag}</span>
                    <span className="round-arrow">
                      <SiteIcon className="icon" name="arrow-up" />
                    </span>
                  </button>
                  <p className="product-category">{item.category}</p>
                  <button
                    className="product-title"
                    onClick={show}
                    type="button"
                  >
                    {item.title} <span>↗</span>
                  </button>
                  <p className="product-description">{item.teaser}</p>
                </article>
              );
            })}
      </div>

      {!live && (
        <>
          <p className="sr-only" id="filter-status" role="status">
            {status}
          </p>
          <p className="collection-disclaimer">
            Collection previews · Illustrative imagery · Orders aren&apos;t open
            just yet.
          </p>
        </>
      )}

      <div className="region-discovery">
        <div className="region-heading">
          <p className="eyebrow">A LITTLE CURIOSITY GOES A LONG WAY</p>
          <h3>Where will your next find take you?</h3>
        </div>
        <div className="region-grid">
          {REGION_ORDER.map((key) => {
            const region = regions[key];
            const slug = REGION_STATE[key];
            return highlights.regions.includes(slug) ? (
              <Link href={`/explore?region=${slug}`} key={key}>
                <RegionBody region={region} />
                <span className="region-arrow">↗</span>
              </Link>
            ) : (
              <div className="region-coming-soon" key={key}>
                <RegionBody region={region} />
                <small className="coming-soon">Coming soon</small>
              </div>
            );
          })}
        </div>
        {!live && (
          <p className="region-note">
            Places we&apos;re looking to explore. These are collection concepts,
            not active seller listings.
          </p>
        )}
      </div>
    </section>
  );
}

function ProductDialog({ previewKey }: { previewKey: ProductPreviewKey }) {
  const { closeDialog } = useSite();
  const item = productPreviews[previewKey];
  return (
    <>
      <Image
        alt={item.alt}
        className="dialog-image"
        height={720}
        src={item.image}
        width={720}
      />
      <div className="dialog-content">
        <p className="eyebrow">{item.category}</p>
        <h2 id="dialog-title">{item.title}</h2>
        <p>{item.description}</p>
        <p>{item.detail}</p>
        <div className="dialog-notice">
          <strong>A little preview, for now.</strong>
          <br />
          Our first collections are being curated. Orders and reservations are
          not yet open.
        </div>
        <button className="button primary" onClick={closeDialog} type="button">
          Keep exploring <SiteIcon className="icon" name="arrow" />
        </button>
      </div>
    </>
  );
}

function RegionBody({
  region,
}: {
  region: { label: string; name: string; teaser: string };
}) {
  return (
    <>
      <span>{region.label}</span>
      <strong>{region.name}</strong>
      <small>{region.teaser}</small>
    </>
  );
}
