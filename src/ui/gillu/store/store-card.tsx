import Image from "next/image";
import Link from "next/link";

import type { StorefrontCard } from "~/modules/catalog/application/storefront";

import { stateName } from "~/modules/catalog/domain/indian-states";

import { MadeBadge } from "./made-badge";
import { formatRupees } from "./money";

const PLACEHOLDER = "/gillu/basket.webp";

/** One product in a grid: photo, made badge, name, price, origin and maker. */
export function StoreCard({ card }: { card: StorefrontCard }) {
  const place = [
    card.originPlace,
    card.originState ? stateName(card.originState) : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <article className="store-card">
      <Link
        className="store-card-link"
        href={`/shops/${card.shopSlug}/${card.slug}`}
      >
        <div className="store-card-media">
          <Image
            alt=""
            fill
            sizes="(max-width: 600px) 50vw, 25vw"
            src={card.coverImageUrl ?? PLACEHOLDER}
            unoptimized
          />
        </div>
        <div className="store-card-body">
          <MadeBadge madeHow={card.madeHow} />
          <h3>{card.name}</h3>
          <p className="store-card-price">
            From {formatRupees(card.priceFromPaise)}
          </p>
          {place && <p className="small muted">{place}</p>}
          {card.madeBy && <p className="small muted">by {card.madeBy}</p>}
        </div>
      </Link>
    </article>
  );
}
