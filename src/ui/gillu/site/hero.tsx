import Image from "next/image";
import { Fragment } from "react";

import { SiteIcon } from "./site-icons";

export function Announcement() {
  return (
    <div className="announcement">
      <span>Har gaon se, har ghar tak.</span>
      <span className="announcement-center">
        A little India. A lot of heart.
      </span>
      <span>
        Our first collection is coming soon <span aria-hidden="true">✧</span>
      </span>
    </div>
  );
}

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="hero container">
      <div className="hero-copy">
        <p className="eyebrow">
          <span className="tiny-flower">✦</span> LOCAL ROOTS. EVERYDAY JOY.
        </p>
        <h1 id="hero-title">
          From our roots,
          <br />
          to your <em>rituals.</em>
        </h1>
        <p className="hero-description">
          Regional flavours. Handmade treasures.
          <br />
          Little things that make a celebration
          <br className="desktop-break" /> feel like home.
        </p>
        <div className="hero-actions">
          <a className="button primary" href="/explore">
            Explore the collection <SiteIcon className="icon" name="arrow-up" />
          </a>
          <a className="text-link" href="#our-story">
            The Gillu story <span aria-hidden="true">↗</span>
          </a>
        </div>
        <div className="hero-note">
          <SiteIcon name="flower" />
          <p>
            Good things take root in small places.
            <br />
            <strong>We&apos;re here to help you find them.</strong>
          </p>
        </div>
      </div>
      <div className="hero-art">
        <div aria-hidden="true" className="arch-outline" />
        <div className="hero-photo">
          <Image
            alt="A festive still life with marigolds, clay diyas, laddoos, cashews, and a wrapped gift"
            height={933}
            priority
            src="/gillu/hero.webp"
            width={1400}
          />
        </div>
        <div aria-label="Rooted in India, made for you" className="hero-stamp">
          <span>ROOTED IN INDIA</span>
          <SiteIcon name="flower" />
          <span>MADE FOR YOU</span>
        </div>
        <div className="hero-label">
          <span className="little-line" />
          <div>
            A little festive.
            <br />
            <em>A little closer to home.</em>
          </div>
        </div>
        <p className="image-caption">A glimpse of the Gillu festive edit</p>
      </div>
    </section>
  );
}

const RIBBON = [
  "A taste of home",
  "A touch of craft",
  "A reason to celebrate",
  "From makers, with love",
];

export function Ribbon() {
  return (
    <div aria-label="The Gillu spirit" className="ribbon">
      <div>
        {RIBBON.map((text) => (
          <Fragment key={text}>
            <span>{text}</span>
            <SiteIcon name="flower" />
          </Fragment>
        ))}
      </div>
    </div>
  );
}
