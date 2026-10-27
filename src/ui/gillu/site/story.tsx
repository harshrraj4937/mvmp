import Image from "next/image";
import Link from "next/link";

import { SiteIcon, type SiteIconName } from "./site-icons";

export function Story() {
  return (
    <section
      aria-labelledby="story-title"
      className="story section container"
      id="our-story"
    >
      <div className="story-image">
        <Image
          alt="An illustrative close-up of a potter's hands carefully shaping a clay bowl"
          height={800}
          src="/gillu/hands.webp"
          width={1200}
        />
        <div className="story-image-note">
          The beauty is in
          <br />
          <em>the making.</em>
          <SiteIcon name="flower" />
        </div>
        <span className="story-caption">
          Illustrative image of the making process
        </span>
      </div>
      <div className="story-copy">
        <p className="eyebrow">SMALL PLACES. EXTRAORDINARY PEOPLE.</p>
        <h2 id="story-title">
          Behind every find,
          <br />
          there&apos;s a pair of
          <br />
          <em>thoughtful hands.</em>
        </h2>
        <p>
          A family recipe. A skill passed down. A small workshop with something
          wonderful to share.
        </p>
        <p>
          Gillu is being built to bring regional makers and their creations a
          little closer to you. Because the things we bring home can carry more
          than beauty. They can carry a story.
        </p>
        <a className="text-link" href="#sell">
          Help us write the next chapter{" "}
          <SiteIcon className="icon" name="arrow-up" />
        </a>
      </div>
    </section>
  );
}

const VALUES: readonly {
  icon: SiteIconName;
  lines: readonly [string, string];
  title: string;
}[] = [
  {
    icon: "leaf",
    lines: ["Regional finds with a connection", "to where they come from."],
    title: "Rooted in place",
  },
  {
    icon: "hands",
    lines: [
      "A marketplace being built around",
      "independent makers and businesses.",
    ],
    title: "People at the heart",
  },
  {
    icon: "gift",
    lines: ["For meaningful gifting,", "and a little everyday joy."],
    title: "Chosen with thought",
  },
];

export function Values() {
  return (
    <section aria-label="What we're building" className="values container">
      {VALUES.map((value) => (
        <div key={value.title}>
          <SiteIcon name={value.icon} />
          <h3>{value.title}</h3>
          <p>
            {value.lines[0]}
            <br />
            {value.lines[1]}
          </p>
        </div>
      ))}
    </section>
  );
}

const STEPS = [
  {
    body: "Find regional products and get to know the places and people behind them.",
    title: "Discover",
  },
  {
    body: "Explore product details and place your order when the marketplace opens.",
    title: "Choose",
  },
  {
    body: "Sellers prepare their products, with shipping coordination planned through Gillu.",
    title: "Receive",
  },
];

export function HowItWorks() {
  return (
    <section aria-labelledby="how-title" className="how-it-works container">
      <div className="how-heading">
        <p className="eyebrow">THE EXPERIENCE WE&apos;RE BUILDING</p>
        <h2 id="how-title">
          From their hands.
          <br />
          <em>To your home.</em>
        </h2>
      </div>
      <div className="how-steps">
        {STEPS.map((step, index) => (
          <div key={step.title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </div>
        ))}
      </div>
      <p className="how-note">
        We&apos;re preparing product information, packaging guidance, and order
        support before launch.
      </p>
    </section>
  );
}

/** Onboarding is real now, so the seller button links straight to it (spec §4.3). */
export function SellerSection() {
  return (
    <section
      aria-labelledby="seller-title"
      className="seller-section container"
      id="sell"
    >
      <div aria-hidden="true" className="seller-pattern" />
      <div>
        <p className="eyebrow">FOR THE MAKERS, DREAMERS &amp; DOERS</p>
        <h2 id="seller-title">
          Aapka hunar.
          <br />
          <em>Naye gharon tak.</em>
        </h2>
        <p>
          You make something special.
          <br />
          Let&apos;s help more people discover it.
        </p>
      </div>
      <div className="seller-right">
        <p>
          From family kitchens to artisan workshops, we&apos;re creating a place
          for India&apos;s independent businesses to grow beyond their
          neighbourhood.
        </p>
        <Link className="button cream" href="/merchant/onboarding">
          Start selling <SiteIcon className="icon" name="arrow-up" />
        </Link>
        <span>Our seller community is taking shape.</span>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="footer-top container">
        <div>
          <Link aria-label="Gillu home" className="brand" href="/">
            <SiteIcon className="brand-icon" name="squirrel" />
            <span>
              gillu<span className="brand-dot">.</span>
            </span>
          </Link>
          <p>A little India. A lot of heart.</p>
        </div>
        <div className="footer-links">
          <a href="#discover">Discover</a>
          <a href="#celebrations">Festive edits</a>
          <a href="#our-story">Our story</a>
          <a href="#sell">Sell on Gillu</a>
        </div>
        <div className="footer-tagline">
          Har gaon se,
          <br />
          <em>har ghar tak.</em>
          <SiteIcon name="flower" />
        </div>
      </div>
      <div className="footer-bottom container">
        <span>© 2026 Gillu. Growing with care.</span>
        <span>Rooted in tradition. Made for tomorrow.</span>
      </div>
    </footer>
  );
}
