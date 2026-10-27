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

export default function HomePage() {
  return (
    <>
      <Announcement />
      <SiteHeader />
      <main id="main">
        <Hero />
        <Ribbon />
        <Collection />
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
