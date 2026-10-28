import Image from "next/image";

import { Paragraphs } from "./paragraphs";

export interface ShopPhoto {
  alt: string;
  height: number;
  id: string;
  url: string;
  width: number;
}

/** A first visit: the shop's place, name, full story and photos. */
export function ShopStory({
  photos,
  place,
  storeName,
  story,
}: {
  photos: ShopPhoto[];
  place: string;
  storeName: string;
  story: null | string;
}) {
  const [cover, ...rest] = photos;
  return (
    <header className="shop-story">
      <p className="eyebrow">{place}</p>
      <h1>{storeName}</h1>
      <div className="shop-story-text">
        <Paragraphs text={story} />
      </div>
      {cover && (
        <div className="shop-photos">
          <figure className="shop-photo-cover">
            <Image
              alt={cover.alt}
              height={cover.height}
              src={cover.url}
              unoptimized
              width={cover.width}
            />
          </figure>
          {rest.map((photo) => (
            <figure className="shop-photo" key={photo.id}>
              <Image
                alt={photo.alt}
                height={photo.height}
                src={photo.url}
                unoptimized
                width={photo.width}
              />
            </figure>
          ))}
        </div>
      )}
    </header>
  );
}
