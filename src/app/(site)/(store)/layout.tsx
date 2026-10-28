import { SiteHeader } from "~/ui/gillu/site/site-header.client";
import { SiteFooter } from "~/ui/gillu/site/story";

/** Store pages: the site header and footer around the store's content. */
export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="store" id="main">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
