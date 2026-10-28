/** Landing-page copy and preview content, from /opt/NH/gillu app.js @ eacfe57. */

import type { StateSlug } from "~/modules/catalog/domain/indian-states";
export type CollectionFilter = "all" | "craft" | "food" | "gifts";
export interface Festival {
  alt: string;
  context: string;
  cta: string;
  description: string;
  image: string;
  kicker: string;
  label: string;
  source: string;
  /** Title lines, rendered with a line break between them. */
  title: readonly [string, string];
}
export type FestivalKey = "diwali" | "onam" | "pongal";
export type ProductPreviewKey = "diyas" | "gifts" | "sweets";

export type RegionKey = "goa" | "kerala" | "maharashtra" | "rajasthan";

/** The state each region card stands for, for region filters in explore. */
export const REGION_STATE: Record<RegionKey, StateSlug> = {
  goa: "goa",
  kerala: "kerala",
  maharashtra: "maharashtra",
  rajasthan: "rajasthan",
};

export const FESTIVAL_ORDER: readonly FestivalKey[] = [
  "diwali",
  "onam",
  "pongal",
];

export const festivals: Record<FestivalKey, Festival> = {
  diwali: {
    alt: "Clay lamps and sweets styled for a Diwali celebration",
    context:
      "Clay diyas, rangoli, and sharing sweets are part of many Diwali celebrations. Traditions vary across regions and communities.",
    cta: "Explore the Diwali edit",
    description:
      "The first lamp at the doorstep. A box of mithai passed around. The familiar joy of making a little room for light, and for each other.",
    image: "/gillu/hero.webp",
    kicker: "DIWALI / DEEPAVALI",
    label: "THE FESTIVAL OF LIGHTS",
    source: "https://www.incredibleindia.gov.in/en/festivals-and-events/diwali",
    title: ["Light a diya.", "Make a memory."],
  },
  onam: {
    alt: "A pookkalam made of orange, yellow, white, and purple flower petals in a courtyard",
    context:
      "Pookkalam flower arrangements are part of Onam celebrations in Malayali communities. Their designs and customs can vary locally.",
    cta: "Discover the Onam inspiration",
    description:
      "Petal by petal, a courtyard becomes a celebration. Onam brings the beauty of flowers, the generosity of a shared table, and the joy of coming together.",
    image: "/gillu/onam.webp",
    kicker: "ONAM / KERALA",
    label: "A CELEBRATION IN BLOOM",
    source: "https://www.keralatourism.org/onam/onam-rituals/ona-pookkalam",
    title: ["A carpet of flowers.", "A welcome home."],
  },
  pongal: {
    alt: "A clay pot of cooked rice with turmeric leaves, sugarcane, and a white kolam on the ground",
    context:
      "Kolam at the entrance and cooking newly harvested rice with milk are among Pongal traditions. Practices differ between households and communities.",
    cta: "Discover the Pongal inspiration",
    description:
      "A freshly drawn kolam. A pot of new rice. A moment to be thankful for what the earth gives, and for the people we share it with.",
    image: "/gillu/pongal.webp",
    kicker: "PONGAL / TAMIL TRADITIONS",
    label: "THE JOY OF A NEW HARVEST",
    source:
      "https://www.pib.gov.in/PressReleasePage.aspx?PRID=1995957&lang=2&reg=48",
    title: ["New harvest.", "Familiar happiness."],
  },
};

export interface ProductPreview {
  alt: string;
  cardAlt: string;
  category: string;
  description: string;
  detail: string;
  filter: Exclude<CollectionFilter, "all">;
  image: string;
  tag: string;
  teaser: string;
  title: string;
}

export const PRODUCT_ORDER: readonly ProductPreviewKey[] = [
  "sweets",
  "diyas",
  "gifts",
];

export const productPreviews: Record<ProductPreviewKey, ProductPreview> = {
  diyas: {
    alt: "Handmade terracotta diyas",
    cardAlt: "Hand-shaped terracotta diyas on a softly lit surface",
    category: "CRAFTED FOR YOUR HOME",
    description:
      "Small objects can hold a lot of feeling. This edit explores clay lamps and handmade pieces that bring a little warmth to your spaces and celebrations.",
    detail:
      "The finished collection will include product materials, maker information, dimensions, and care details. This image represents the collection’s creative direction.",
    filter: "craft",
    image: "/gillu/clay.webp",
    tag: "SHAPED WITH CARE",
    teaser: "A warm glow. A maker's touch.",
    title: "Little lights, big joy",
  },
  gifts: {
    alt: "A cane basket of wrapped gifts",
    cardAlt: "A woven cane basket with thoughtfully wrapped gifts",
    category: "THOUGHTFUL GIFTING",
    description:
      "For a thank-you, a homecoming, or a just-because. We’re imagining gifts that feel personal: useful, beautiful finds with a connection to the people who make them.",
    detail:
      "Gift combinations, packaging, availability, and delivery options will be confirmed when our first collection opens.",
    filter: "gifts",
    image: "/gillu/basket.webp",
    tag: "A LITTLE MORE PERSONAL",
    teaser: "For your favourite people, near and far.",
    title: "Wrapped with a little love",
  },
  sweets: {
    alt: "A brass dish of motichoor laddoos",
    cardAlt: "Golden motichoor laddoos in a brass dish",
    category: "REGIONAL FLAVOURS",
    description:
      "For the box opened after dinner, the plate passed to a neighbour, and the taste that reminds you of home. Our food edit is an invitation to discover regional sweets and packaged specialities.",
    detail:
      "We’re shaping this collection with small businesses in mind. Ingredients, maker details, prices, and delivery information will appear with actual listings.",
    filter: "food",
    image: "/gillu/sweets.webp",
    tag: "FOR THE FESTIVE TABLE",
    teaser: "Some flavours always bring you home.",
    title: "Mithai & memories",
  },
};

export const COLLECTION_FILTERS: readonly {
  key: CollectionFilter;
  label: string;
}[] = [
  { key: "all", label: "All finds" },
  { key: "food", label: "Mithai & more" },
  { key: "craft", label: "Handcrafted" },
  { key: "gifts", label: "Thoughtful gifts" },
];

export interface Region {
  category: string;
  description: string;
  heading: string;
  label: string;
  name: string;
  teaser: string;
}

export const REGION_ORDER: readonly RegionKey[] = [
  "goa",
  "maharashtra",
  "rajasthan",
  "kerala",
];

export const regions: Record<RegionKey, Region> = {
  goa: {
    category: "CASHEWS & COASTAL FLAVOURS",
    description:
      "A collection concept for regional cashews and local specialities from Goa.",
    heading: "A little taste of Goa",
    label: "01 / THE WEST COAST",
    name: "Goa",
    teaser: "Cashews & coastal flavours",
  },
  kerala: {
    category: "SPICES & REGIONAL SPECIALITIES",
    description:
      "A collection concept for regional spices, foods, and handmade products from Kerala.",
    heading: "A find from Kerala",
    label: "04 / THE SOUTHWEST COAST",
    name: "Kerala",
    teaser: "Spices & regional specialities",
  },
  maharashtra: {
    category: "REGIONAL BITES & HANDMADE FINDS",
    description:
      "A collection concept for regional snacks, local flavours, and handmade creations from Maharashtra.",
    heading: "Made in Maharashtra",
    label: "02 / WESTERN INDIA",
    name: "Maharashtra",
    teaser: "Regional bites & handmade finds",
  },
  rajasthan: {
    category: "ART & TREASURES FOR YOUR HOME",
    description:
      "A collection concept for crafts, art, and decorative objects from Rajasthan.",
    heading: "The colours of Rajasthan",
    label: "03 / NORTHWESTERN INDIA",
    name: "Rajasthan",
    teaser: "Art & treasures for your home",
  },
};

export const SITE_NAV = [
  { href: "/explore", label: "Explore" },
  { href: "/#discover", label: "Discover" },
  { href: "/#celebrations", label: "Festive edits" },
  { href: "/#our-story", label: "Our story" },
] as const;
