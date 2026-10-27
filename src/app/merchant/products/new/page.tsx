import Link from "next/link";

import { db } from "~/db";
import { listActiveCategories } from "~/modules/catalog";
import { requireApprovedMerchant } from "~/modules/merchants";
import { Icon } from "~/ui/gillu/desk/icon";
import { PageHeading } from "~/ui/gillu/desk/page-heading";
import { Panel } from "~/ui/gillu/desk/panel";
import { NewProductForm } from "~/ui/gillu/desk/product-form.client";

export default async function NewProductPage() {
  await requireApprovedMerchant("/merchant/products/new");
  const categories = await listActiveCategories(db);
  return (
    <>
      <PageHeading
        action={
          <Link className="button" href="/merchant/products">
            <Icon name="grid" />
            All products
          </Link>
        }
        subtitle="Saved as a draft. Add a photo, then publish when it is ready."
        title="Add to your collection."
      />
      <Panel>
        <NewProductForm
          categories={categories.map(({ id, name }) => ({ id, name }))}
        />
      </Panel>
    </>
  );
}
