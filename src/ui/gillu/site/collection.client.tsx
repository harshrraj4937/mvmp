"use client";

import Image from "next/image";

import {
  COLLECTION_FILTERS,
  PRODUCT_ORDER,
  type ProductPreviewKey,
  productPreviews,
  REGION_ORDER,
  type RegionKey,
  regions,
} from "./content";
import { SiteIcon } from "./site-icons";
import { useSite } from "./site-shell.client";

const COUNT_WORDS = ["no", "one", "two", "three"];

/** "The Gillu edit": illustrative collection previews and region concepts. */
export function Collection() {
  const { filter, openDialog, setFilter } = useSite();
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
          <p className="eyebrow">THE GILLU EDIT</p>
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
      <div className="product-grid" id="product-grid">
        {PRODUCT_ORDER.map((key) => {
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
              <button className="product-title" onClick={show} type="button">
                {item.title} <span>↗</span>
              </button>
              <p className="product-description">{item.teaser}</p>
            </article>
          );
        })}
      </div>
      <p className="sr-only" id="filter-status" role="status">
        {status}
      </p>
      <p className="collection-disclaimer">
        Collection previews · Illustrative imagery · Orders aren&apos;t open
        just yet.
      </p>
      <div className="region-discovery">
        <div className="region-heading">
          <p className="eyebrow">A LITTLE CURIOSITY GOES A LONG WAY</p>
          <h3>Where will your next find take you?</h3>
        </div>
        <div className="region-grid">
          {REGION_ORDER.map((key) => {
            const region = regions[key];
            return (
              <button
                key={key}
                onClick={() => {
                  openDialog(<RegionDialog regionKey={key} />);
                }}
                type="button"
              >
                <span>{region.label}</span>
                <strong>{region.name}</strong>
                <small>{region.teaser}</small>
                <span className="region-arrow">↗</span>
              </button>
            );
          })}
        </div>
        <p className="region-note">
          Places we&apos;re looking to explore. These are collection concepts,
          not active seller listings.
        </p>
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

function RegionDialog({ regionKey }: { regionKey: RegionKey }) {
  const { closeDialog } = useSite();
  const region = regions[regionKey];
  return (
    <div className="dialog-content">
      <p className="eyebrow">{region.category}</p>
      <h2 id="dialog-title">{region.heading}</h2>
      <p>{region.description}</p>
      <div className="dialog-notice">
        We&apos;re exploring the first regional collections. Participating
        makers, actual products, and delivery availability will be confirmed
        before launch.
      </div>
      <button className="button primary" onClick={closeDialog} type="button">
        Keep discovering <SiteIcon className="icon" name="arrow" />
      </button>
    </div>
  );
}
