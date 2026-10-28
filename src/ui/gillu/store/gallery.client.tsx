"use client";

import Image from "next/image";
import { useRef, useState } from "react";

interface Photo {
  alt: string;
  height: number;
  id: string;
  url: string;
  width: number;
}

const PLACEHOLDER = "/gillu/basket.webp";

/** Product photos: the main photo and thumbnails; arrow keys move between thumbnails. */
export function Gallery({ name, photos }: { name: string; photos: Photo[] }) {
  const [index, setIndex] = useState(0);
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = photos[index];

  const go = (next: number) => {
    const bounded = (next + photos.length) % photos.length;
    setIndex(bounded);
    thumbs.current[bounded]?.focus();
  };

  return (
    <div className="gallery">
      <div className="gallery-main">
        <Image
          alt={current?.alt || name}
          fill
          priority
          sizes="(max-width: 900px) 100vw, 50vw"
          src={current?.url ?? PLACEHOLDER}
          unoptimized
        />
      </div>
      {photos.length > 1 && (
        <div className="gallery-thumbs">
          {photos.map((photo, position) => (
            <button
              aria-current={position === index ? "true" : undefined}
              aria-label={`Show photo ${position + 1}`}
              key={photo.id}
              onClick={() => {
                setIndex(position);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") {
                  go(position + 1);
                } else if (event.key === "ArrowLeft") {
                  go(position - 1);
                }
              }}
              ref={(node) => {
                thumbs.current[position] = node;
              }}
              type="button"
            >
              <Image alt="" fill sizes="80px" src={photo.url} unoptimized />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
