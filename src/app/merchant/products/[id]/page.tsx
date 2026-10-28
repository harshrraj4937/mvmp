import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "~/db";
import {
  getProduct,
  listActiveCategories,
  type ProductDetail,
} from "~/modules/catalog";
import { requireApprovedMerchant } from "~/modules/merchants";
import { NotFoundError } from "~/platform/errors";
import { Icon } from "~/ui/gillu/desk/icon";
import { ImagesPanel } from "~/ui/gillu/desk/images-panel.client";
import { PageHeading } from "~/ui/gillu/desk/page-heading";
import { Panel } from "~/ui/gillu/desk/panel";
import { ProductStatusBadge } from "~/ui/gillu/desk/product-card";
import { ProductDetailsForm } from "~/ui/gillu/desk/product-form.client";
import { StatusActions } from "~/ui/gillu/desk/status-actions.client";
import { VariantsTable } from "~/ui/gillu/desk/variants-table.client";

const BLOCKER_TEXT = {
  category: "Choose an active category",
  composition: "List its ingredients",
  image: "Add at least one image",
  made_by: "Say who made it",
  made_how: "Choose handmade or homemade",
  origin: "Say where it comes from (state and place)",
  shop_story: "Finish your shop's story",
  variant: "Add a variant with a price",
} as const;

export default async function EditProductPage({
  params,
}: PageProps<"/merchant/products/[id]">) {
  const { id } = await params;
  const merchant = await requireApprovedMerchant(`/merchant/products/${id}`);
  let product: ProductDetail;
  try {
    product = await getProduct(db, merchant, id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }
  const categories = await listActiveCategories(db);
  const options = categories.map(({ id: value, name }) => ({
    id: value,
    name,
  }));
  // A hidden category stays selectable for the product that already uses it.
  if (!options.some((option) => option.id === product.categoryId)) {
    options.push({
      id: product.categoryId,
      name: `${product.categoryName} (hidden by Gillu)`,
    });
  }
  const archived = product.status === "ARCHIVED";
  const showBlockers =
    (product.status === "DRAFT" || product.status === "UNPUBLISHED") &&
    product.publishBlockers.length > 0;

  return (
    <>
      <p>
        <Link className="text-button" href="/merchant/products">
          <Icon name="grid" />
          All products
        </Link>
      </p>
      <PageHeading
        action={
          <StatusActions productId={product.id} status={product.status} />
        }
        subtitle={
          <span className="row wrap">
            {product.name}
            <ProductStatusBadge status={product.status} />
          </span>
        }
        title="A little product polish."
      />
      <div className="form-sections">
        {product.adminHoldReason && (
          <p className="notice danger">
            Gillu has paused this product: {product.adminHoldReason}
          </p>
        )}
        {showBlockers && (
          <div className="notice">
            <strong>Before you can publish:</strong>
            <ul aria-label="Before you can publish:" className="blockers">
              {product.publishBlockers.map((blocker) => (
                <li key={blocker}>{BLOCKER_TEXT[blocker]}</li>
              ))}
            </ul>
          </div>
        )}
        {archived && (
          <p className="notice">
            This product is archived. It cannot be changed or restored.
          </p>
        )}
        <Panel title="Product details">
          <ProductDetailsForm
            categories={options}
            initial={{
              categoryId: product.categoryId,
              description: product.description ?? "",
              name: product.name,
            }}
            key={product.id}
            productId={product.id}
            readOnly={archived}
          />
        </Panel>
        <Panel title="Photos">
          <ImagesPanel
            images={product.images}
            productId={product.id}
            readOnly={archived}
          />
        </Panel>
        <Panel title="Variants and stock">
          <VariantsTable
            productId={product.id}
            readOnly={archived}
            variants={product.variants}
          />
        </Panel>
      </div>
    </>
  );
}
