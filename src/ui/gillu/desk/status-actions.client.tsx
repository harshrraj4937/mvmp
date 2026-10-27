"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ProductSummary } from "~/modules/catalog";

import { sendJson } from "~/lib/api-client";

import { Modal } from "./modal.client";

type Action = "archive" | "publish" | "unpublish";

/** Publish, unpublish and archive (archive asks first: it is final). */
export function StatusActions({
  productId,
  status,
}: {
  productId: string;
  status: ProductSummary["status"];
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(action: Action) {
    setBusy(true);
    const result = await sendJson(
      `/api/v1/merchant/products/${productId}/${action}`,
      "POST",
    );
    setBusy(false);
    setConfirming(false);
    setMessage(result.error?.message ?? "");
    if (!result.error) {
      router.refresh();
    }
  }

  if (status === "ARCHIVED") {
    return null;
  }
  return (
    <>
      {(status === "DRAFT" || status === "UNPUBLISHED") && (
        <button
          className="button primary"
          disabled={busy}
          onClick={() => void run("publish")}
          type="button"
        >
          Publish
        </button>
      )}
      {status === "PUBLISHED" && (
        <button
          className="button"
          disabled={busy}
          onClick={() => void run("unpublish")}
          type="button"
        >
          Unpublish
        </button>
      )}
      <button
        className="button"
        disabled={busy}
        onClick={() => setConfirming(true)}
        type="button"
      >
        Archive
      </button>
      {message && (
        <p className="notice danger status-message" role="alert">
          {message}
        </p>
      )}
      <Modal
        onClose={() => setConfirming(false)}
        open={confirming}
        title="Archive this product?"
      >
        <div className="notice">
          Archived products cannot be restored. Customers will no longer see it,
          and you will not be able to edit it.
        </div>
        <div className="form-actions">
          <button
            className="button"
            onClick={() => setConfirming(false)}
            type="button"
          >
            Keep it
          </button>
          <button
            className="button danger"
            disabled={busy}
            onClick={() => void run("archive")}
            type="button"
          >
            Archive product
          </button>
        </div>
      </Modal>
    </>
  );
}
