import type { Metadata } from "next";

import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { db } from "~/db";
import { getStorefrontShop } from "~/modules/catalog";
import { stateName } from "~/modules/catalog/domain/indian-states";
import { MarkShopSeen } from "~/ui/gillu/store/mark-shop-seen.client";
import { parseSeenShops, SEEN_SHOPS_COOKIE } from "~/ui/gillu/store/seen-shops";
import { ShopStory } from "~/ui/gillu/store/shop-story";
import { StoreCard } from "~/ui/gillu/store/store-card";
import { StoryStrip } from "~/ui/gillu/store/story-strip.client";

export async function generateMetadata({
  params,
}: PageProps<"/shops/[shop]">): Promise<Metadata> {
  const { shop } = await params;
  const found = await getStorefrontShop(db, shop);
  if (!found) {
    return { title: "Not found · Gillu" };
  }
  const title = `${found.storeName} · Gillu`;
  const image = found.images[0]?.url;
  return {
    openGraph: {
      images: image ? [image] : [],
      title,
      type: "website",
    },
    title,
  };
}

export default async function ShopPage({ params }: PageProps<"/shops/[shop]">) {
  const { shop } = await params;
  const found = await getStorefrontShop(db, shop);
  if (!found) {
    notFound();
  }
  const seen = parseSeenShops(
    (await cookies()).get(SEEN_SHOPS_COOKIE)?.value,
  ).includes(shop);
  const place = `${found.homePlace}, ${stateName(found.homeState)}`;

  return (
    <article className="shop-page">
      <MarkShopSeen slug={shop} />
      <a className="skip-link-inline" href="#products">
        Skip to products
      </a>
      {seen ? (
        <StoryStrip
          place={place}
          storeName={found.storeName}
          story={found.story}
        />
      ) : (
        <ShopStory
          photos={found.images}
          place={place}
          storeName={found.storeName}
          story={found.story}
        />
      )}
      <section aria-labelledby="products-heading" id="products">
        <h2 id="products-heading">From {found.storeName}</h2>
        {found.products.length === 0 ? (
          <p className="muted">New finds coming soon.</p>
        ) : (
          <ul className="store-grid">
            {found.products.map((card) => (
              <li key={card.productId}>
                <StoreCard card={card} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
