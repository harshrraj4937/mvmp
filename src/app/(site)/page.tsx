import { db } from "~/db";
import { storefrontHighlights } from "~/modules/catalog";
import { Celebrations } from "~/ui/gillu/site/celebrations.client";
import { Collection } from "~/ui/gillu/site/collection.client";
import { EarlyAccess } from "~/ui/gillu/site/early-access.client";
import { Announcement, Hero, Ribbon } from "~/ui/gillu/site/hero";
import { SiteHeader } from "~/ui/gillu/site/site-header.client";
import {
  HowItWorks,
  SellerSection,
  SiteFooter,
  Story,
  Values,
} from "~/ui/gillu/site/story";

/** Reads live products, so the page is rendered per request rather than at build. */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const highlights = await storefrontHighlights(db);
  return (
    <>
      <Announcement />
      <SiteHeader />
      <main id="main">
        <Hero />
        <Ribbon />
        <Collection highlights={highlights} />
        <Celebrations />
        <Story />
        <Values />
        <HowItWorks />
        <SellerSection />
        <EarlyAccess />
      </main>
      <SiteFooter />
    </>
  );
}
