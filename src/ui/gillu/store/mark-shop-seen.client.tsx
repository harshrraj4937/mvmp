"use client";

import { useEffect } from "react";

import { parseSeenShops, SEEN_SHOPS_COOKIE, withSeenShop } from "./seen-shops";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Records this shop as seen, so the next visit folds the story away. */
export function MarkShopSeen({ slug }: { slug: string }) {
  useEffect(() => {
    try {
      const pair = document.cookie
        .split("; ")
        .find((item) => item.startsWith(`${SEEN_SHOPS_COOKIE}=`));
      const current = pair?.slice(SEEN_SHOPS_COOKIE.length + 1);
      const next = withSeenShop(parseSeenShops(current), slug);
      document.cookie = `${SEEN_SHOPS_COOKIE}=${next.join(",")}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
    } catch {
      // Cookies blocked: the story simply stays in full on every visit.
    }
  }, [slug]);
  return null;
}
