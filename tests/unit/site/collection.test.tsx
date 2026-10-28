import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import type { StorefrontCard } from "~/modules/catalog/application/storefront";

import { Collection } from "~/ui/gillu/site/collection.client";
import { COLLECTION_FILTERS } from "~/ui/gillu/site/content";
import { SiteShell } from "~/ui/gillu/site/site-shell.client";

type Highlights = Parameters<typeof Collection>[0]["highlights"];

const EMPTY: Highlights = { categories: [], newest: [], regions: [] };

const card: StorefrontCard = {
  coverImageUrl: null,
  madeBy: "Asha",
  madeHow: "HOMEMADE",
  name: "Kokum candy",
  originPlace: "Mapusa",
  originState: "goa",
  priceFromPaise: 34_900,
  productId: "product-1",
  shopLinkable: true,
  shopSlug: "goa-kitchen",
  slug: "kokum-candy",
  storeName: "Goa Kitchen",
};

function render(highlights: Highlights): string {
  return renderToStaticMarkup(
    <SiteShell className="gillu-site">
      <Collection highlights={highlights} />
    </SiteShell>,
  );
}

describe("Collection with no live products", () => {
  test("shows the illustrative previews and their tabs", () => {
    const html = render(EMPTY);
    expect(html).toContain("Collection previews · Illustrative imagery");
    expect(html).toContain("A taste of what");
    for (const filter of COLLECTION_FILTERS) {
      expect(html).toContain(filter.label.replaceAll("&", "&amp;"));
    }
  });

  test("a region with products links to explore; the others say Coming soon", () => {
    const html = render({ ...EMPTY, regions: ["goa"] });
    expect(html).toContain('href="/explore?region=goa"');
    expect(html).not.toContain('href="/explore?region=kerala"');
    expect(html.match(/Coming soon/g)).toHaveLength(3);
  });
});

describe("Collection with live products", () => {
  test("shows real cards, category links and Explore everything, not the previews", () => {
    const html = render({
      categories: [{ name: "Snacks", slug: "snacks-and-sweets" }],
      newest: [card],
      regions: [],
    });
    expect(html).toContain("Kokum candy");
    expect(html).toContain('href="/explore?category=snacks-and-sweets"');
    expect(html).toContain("Explore everything");
    expect(html).not.toContain("Illustrative imagery");
    expect(html).not.toContain("THE GILLU EDIT");
  });
});
