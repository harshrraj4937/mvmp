import Link from "next/link";

import { db } from "~/db";
import { listProducts, productListQuerySchema } from "~/modules/catalog";
import { requireApprovedMerchant } from "~/modules/merchants";
import { EmptyState } from "~/ui/gillu/desk/empty-state";
import { Icon } from "~/ui/gillu/desk/icon";
import { PageHeading } from "~/ui/gillu/desk/page-heading";
import { ProductCard } from "~/ui/gillu/desk/product-card";

import { CatalogToolbar } from "./page.client";

export default async function MerchantProductsPage({
  searchParams,
}: PageProps<"/merchant/products">) {
  const merchant = await requireApprovedMerchant("/merchant/products");
  // Unknown or repeated parameters are ignored rather than shown as errors.
  const parsed = productListQuerySchema.safeParse(await searchParams);
  const filter = parsed.success ? parsed.data : {};
  const products = await listProducts(db, merchant, filter);
  const filtered = Boolean(filter.q ?? filter.status);

  const addProduct = (
    <Link className="button primary" href="/merchant/products/new">
      <Icon name="plus" />
      Add a product
    </Link>
  );

  return (
    <>
      <PageHeading
        action={addProduct}
        subtitle="A small collection, with a story in every detail."
        title="The things you make."
      />
      <CatalogToolbar q={filter.q ?? ""} status={filter.status ?? ""} />
      {products.length > 0 ? (
        <div className="catalog-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : filtered ? (
        <EmptyState
          action={
            <Link className="button" href="/merchant/products">
              <Icon name="reset" />
              Clear filters
            </Link>
          }
          body="Try another name or SKU, or clear your filters."
          icon="search"
          title="No products match your search."
        />
      ) : (
        <EmptyState
          action={addProduct}
          body="Add your first product to start building your collection."
          icon="box"
          title="Nothing in this collection yet."
        />
      )}
    </>
  );
}
