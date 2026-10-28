import type { Metadata } from "next";

import { notFound } from "next/navigation";

import { db } from "~/db";
import { getStorefrontProduct } from "~/modules/catalog";
import { stateName } from "~/modules/catalog/domain/indian-states";
import { BuyBox } from "~/ui/gillu/store/buy-box.client";
import { Gallery } from "~/ui/gillu/store/gallery.client";
import { MadeBadge } from "~/ui/gillu/store/made-badge";
import { MakerPanel } from "~/ui/gillu/store/maker-panel";
import { Paragraphs } from "~/ui/gillu/store/paragraphs";

export async function generateMetadata({
  params,
}: PageProps<"/shops/[shop]/[product]">): Promise<Metadata> {
  const { product, shop } = await params;
  const found = await getStorefrontProduct(db, shop, product);
  if (!found) {
    return { title: "Not found · Gillu" };
  }
  const title = `${found.name} · Gillu`;
  const description = (
    found.description ??
    found.composition ??
    found.name
  ).slice(0, 160);
  const image = found.images[0]?.url ?? found.coverImageUrl;
  return {
    description,
    openGraph: {
      description,
      images: image ? [image] : [],
      title,
      type: "website",
    },
    title,
  };
}

export default async function ProductPage({
  params,
}: PageProps<"/shops/[shop]/[product]">) {
  const { product, shop } = await params;
  const found = await getStorefrontProduct(db, shop, product);
  if (!found) {
    notFound();
  }
  const origin = [
    found.originPlace,
    found.originState ? stateName(found.originState) : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <article className="product-page">
      <div className="product-grid">
        <Gallery name={found.name} photos={found.images} />
        <div className="product-info">
          <MadeBadge madeHow={found.madeHow} />
          <h1>{found.name}</h1>
          {origin && <p className="origin">From {origin}</p>}
          {found.madeBy && <p className="muted">Made by {found.madeBy}</p>}
          <BuyBox variants={found.variants} />
          <section className="product-text">
            <Paragraphs text={found.description} />
          </section>
          {found.composition && (
            <section className="product-text">
              <h2>
                {found.compositionLabel === "MATERIALS"
                  ? "Materials"
                  : "Ingredients"}
              </h2>
              <Paragraphs text={found.composition} />
            </section>
          )}
          <MakerPanel
            shop={found.shop}
            shopLinkable={found.shopLinkable}
            shopSlug={found.shopSlug}
          />
        </div>
      </div>
    </article>
  );
}
