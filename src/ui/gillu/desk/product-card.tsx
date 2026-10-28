import Image from "next/image";
import Link from "next/link";

import type { ProductSummary } from "~/modules/catalog";

import { formatPaise } from "~/modules/catalog/domain/money";

import { DeskBadge } from "./badge";
import { Icon } from "./icon";

const MADE_HOW_TEXT = { HANDMADE: "Handmade", HOMEMADE: "Homemade" } as const;

const STATUS_TONE = {
  ARCHIVED: "danger",
  DRAFT: "neutral",
  PENDING_APPROVAL: "warning",
  PUBLISHED: "delivered",
  UNPUBLISHED: "warning",
} as const;

/** Desk product card (source `renderCatalog()`), linking to the edit page. */
export function ProductCard({ product }: { product: ProductSummary }) {
  return (
    <article className="product-card">
      <div className="catalog-image">
        {product.coverImageUrl ? (
          <Image
            alt=""
            height={380}
            src={product.coverImageUrl}
            unoptimized
            width={520}
          />
        ) : (
          <div className="catalog-placeholder">
            <Icon name="box" />
          </div>
        )}
        <ProductStatusBadge status={product.status} />
      </div>
      <div className="product-info">
        <p className="eyebrow">
          {product.categoryName}
          {product.madeHow && ` · ${MADE_HOW_TEXT[product.madeHow]}`}
        </p>
        <h3>{product.name}</h3>
        {product.adminHoldReason && (
          <p className="small muted">Paused by Gillu</p>
        )}
        <div className="row between">
          <strong className="amount">
            {product.priceFromPaise === null
              ? "No price yet"
              : formatPaise(product.priceFromPaise)}
          </strong>
          <StockLabel product={product} />
        </div>
        <Link className="button" href={`/merchant/products/${product.id}`}>
          <Icon name="edit" />
          Edit product
        </Link>
      </div>
    </article>
  );
}

export function ProductStatusBadge({
  status,
}: {
  status: ProductSummary["status"];
}) {
  return <DeskBadge tone={STATUS_TONE[status]}>{status}</DeskBadge>;
}

function StockLabel({ product }: { product: ProductSummary }) {
  if (product.totalAvailable === 0) {
    return <span className="stock low">Out of stock</span>;
  }
  return (
    <span className={product.lowStock ? `stock low` : "stock"}>
      {product.lowStock ? "Low stock · " : ""}
      {product.totalAvailable} in stock
    </span>
  );
}
