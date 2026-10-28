import Image from "next/image";
import Link from "next/link";

import type { StateSlug } from "~/modules/catalog/domain/indian-states";

import { stateName } from "~/modules/catalog/domain/indian-states";

const PLACEHOLDER = "/gillu/hands.webp";

export interface MakerShop {
  coverUrl: null | string;
  homePlace: null | string;
  homeState: null | StateSlug;
  storeName: string;
  storyExcerpt: null | string;
}

/**
 * The shop behind the product. Links to the shop page only when the shop's
 * story is complete; otherwise it names the shop with no link.
 */
export function MakerPanel({
  shop,
  shopLinkable,
  shopSlug,
}: {
  shop: MakerShop;
  shopLinkable: boolean;
  shopSlug: string;
}) {
  if (!shopLinkable) {
    return <p className="sold-by">Sold by {shop.storeName}</p>;
  }
  const place = [
    shop.homePlace,
    shop.homeState ? stateName(shop.homeState) : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <section aria-label="The maker" className="maker-panel">
      <div className="maker-media">
        <Image
          alt=""
          fill
          sizes="(max-width: 600px) 100vw, 320px"
          src={shop.coverUrl ?? PLACEHOLDER}
          unoptimized
        />
      </div>
      <div className="maker-body">
        <h2>{shop.storeName}</h2>
        {place && <p className="small muted">{place}</p>}
        {shop.storyExcerpt && <p>{shop.storyExcerpt}</p>}
        <Link className="text-link" href={`/shops/${shopSlug}`}>
          Meet {shop.storeName}
        </Link>
      </div>
    </section>
  );
}
