"use client";

import Image from "next/image";
import { useRef, useState } from "react";

import { FESTIVAL_ORDER, type FestivalKey, festivals } from "./content";
import { SiteIcon } from "./site-icons";
import { useSite } from "./site-shell.client";

/** Festival tabs (WAI-ARIA tabs: arrows, Home and End move and select). */
export function Celebrations() {
  const { openDialog, showCollection } = useSite();
  const [active, setActive] = useState<FestivalKey>("diwali");
  const tabRefs = useRef<Partial<Record<FestivalKey, HTMLButtonElement>>>({});
  const festival = festivals[active];

  const select = (key: FestivalKey, moveFocus: boolean) => {
    setActive(key);
    if (moveFocus) {
      tabRefs.current[key]?.focus();
    }
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const last = FESTIVAL_ORDER.length - 1;
    const next: Record<string, number> = {
      ArrowLeft: index === 0 ? last : index - 1,
      ArrowRight: index === last ? 0 : index + 1,
      End: last,
      Home: 0,
    };
    const target = next[event.key];
    if (target === undefined) {
      return;
    }
    event.preventDefault();
    const key = FESTIVAL_ORDER[target];
    if (key) {
      select(key, true);
    }
  };

  return (
    <section
      aria-labelledby="celebrations-title"
      className="celebrations section"
      id="celebrations"
    >
      <div className="container">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SO MANY WAYS TO CELEBRATE</p>
            <h2 id="celebrations-title">
              Different traditions.
              <br />
              The same <em>warmth.</em>
            </h2>
          </div>
          <p>
            Every celebration has its own colours,
            <br />
            its own flavours, its own beautiful story.
          </p>
        </div>
        <div
          aria-label="Explore Indian celebrations"
          className="festival-tabs"
          role="tablist"
        >
          {FESTIVAL_ORDER.map((key, index) => {
            const selected = key === active;
            return (
              <button
                aria-controls="festival-panel"
                aria-selected={selected}
                className={selected ? "selected" : undefined}
                id={`tab-${key}`}
                key={key}
                onClick={() => {
                  select(key, false);
                }}
                onKeyDown={(event) => {
                  onKeyDown(event, index);
                }}
                ref={(element) => {
                  if (element) {
                    tabRefs.current[key] = element;
                  }
                }}
                role="tab"
                tabIndex={selected ? 0 : -1}
                type="button"
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}{" "}
                <span>{String(index + 1).padStart(2, "0")}</span>
              </button>
            );
          })}
        </div>
        <div
          aria-labelledby={`tab-${active}`}
          className="festival-panel"
          id="festival-panel"
          role="tabpanel"
        >
          <div className="festival-image">
            <Image
              alt={festival.alt}
              height={933}
              id="festival-image"
              src={festival.image}
              width={1400}
            />
            <span id="festival-image-label">{festival.label}</span>
          </div>
          <div className="festival-copy">
            <SiteIcon className="festival-flower" name="flower" />
            <p className="eyebrow" id="festival-kicker">
              {festival.kicker}
            </p>
            <h3 id="festival-title">
              <TwoLines lines={festival.title} />
            </h3>
            <p id="festival-description">{festival.description}</p>
            <p className="festival-context" id="festival-context">
              {festival.context}
            </p>
            <button
              className="text-link"
              id="festival-explore"
              onClick={() => {
                if (active === "diwali") {
                  showCollection();
                } else {
                  openDialog(<InspirationDialog festivalKey={active} />);
                }
              }}
              type="button"
            >
              {festival.cta} <SiteIcon className="icon" name="arrow-up" />
            </button>
            <a
              className="source-link"
              href={festival.source}
              id="festival-source"
              rel="noopener noreferrer"
              target="_blank"
            >
              Discover the tradition <span>↗</span>
            </a>
          </div>
        </div>
        <p className="festival-footnote">
          A few celebrations from a country full of them. More regional stories
          are on their way.
        </p>
      </div>
    </section>
  );
}

function InspirationDialog({ festivalKey }: { festivalKey: FestivalKey }) {
  const festival = festivals[festivalKey];
  return (
    <>
      <Image
        alt={festival.alt}
        className="dialog-image"
        height={933}
        src={festival.image}
        width={1400}
      />
      <div className="dialog-content">
        <p className="eyebrow">{festival.kicker}</p>
        <h2 id="dialog-title">
          <TwoLines lines={festival.title} />
        </h2>
        <p>{festival.context}</p>
        <div className="dialog-notice">
          This is a cultural inspiration preview. A dedicated product collection
          has not launched yet.
        </div>
        <a
          className="text-link"
          href={festival.source}
          rel="noopener noreferrer"
          target="_blank"
        >
          Read about the tradition ↗
        </a>
      </div>
    </>
  );
}

function TwoLines({ lines }: { lines: readonly [string, string] }) {
  return (
    <>
      {lines[0]}
      <br />
      {lines[1]}
    </>
  );
}
