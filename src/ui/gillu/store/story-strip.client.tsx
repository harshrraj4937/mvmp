"use client";

import { useState } from "react";

import { Paragraphs } from "./paragraphs";

/** A returning visitor's shop header: the name and place, with the story one tap away. */
export function StoryStrip({
  place,
  storeName,
  story,
}: {
  place: string;
  storeName: string;
  story: null | string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-label="Shop" className="story-strip">
      <h1>{storeName}</h1>
      <p className="muted">{place}</p>
      {story && (
        <button
          aria-controls={open ? "shop-story-full" : undefined}
          aria-expanded={open}
          className="text-button"
          onClick={() => {
            setOpen(!open);
          }}
          type="button"
        >
          Read their story
        </button>
      )}
      {open && (
        <div className="shop-story-text" id="shop-story-full">
          <Paragraphs text={story} />
        </div>
      )}
    </section>
  );
}
