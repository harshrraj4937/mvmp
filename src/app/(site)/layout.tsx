import type { Metadata, Viewport } from "next";

import "~/css/gillu-site.css";
import "~/css/gillu-store.css";
import { dmSans, fraunces } from "~/ui/gillu/fonts";
import { SiteIcons } from "~/ui/gillu/site/site-icons";
import { SiteShell } from "~/ui/gillu/site/site-shell.client";

export const metadata: Metadata = {
  description:
    "Discover Gillu: regional flavours, handmade gifts, and local treasures for everyday joys and festive moments. Har gaon se, har ghar tak.",
  icons: { icon: { type: "image/svg+xml", url: "/gillu/favicon.svg" } },
  openGraph: {
    description:
      "Regional flavours. Handmade treasures. Little things that make a celebration feel like home.",
    images: [{ height: 933, url: "/gillu/hero.webp", width: 1400 }],
    title: "Gillu — A little India. A lot of heart.",
    type: "website",
  },
  title: "Gillu — A little India. A lot of heart.",
};

export const viewport: Viewport = { themeColor: "#73392e" };

export default function SiteLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <SiteShell
      className={`
        ${fraunces.variable}
        ${dmSans.variable}
      `}
    >
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteIcons />
      {children}
    </SiteShell>
  );
}
