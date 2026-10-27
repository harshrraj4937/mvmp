"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import type { ApiError } from "~/lib/api-client";
import type { ProductImageView } from "~/modules/catalog";

import { MAX_PRODUCT_IMAGES } from "~/modules/catalog/domain/constants";

/** The product's photos: upload (JPEG, PNG or WebP, ≤ 4 MB) and remove. */
export function ImagesPanel({
  images,
  productId,
  readOnly,
}: {
  images: ProductImageView[];
  productId: string;
  readOnly: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [alt, setAlt] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(path: string, init: RequestInit) {
    setBusy(true);
    try {
      const response = await fetch(path, init);
      const body = (await response.json()) as { error?: ApiError };
      setMessage(body.error?.message ?? "");
      if (response.ok) {
        router.refresh();
      }
      return response.ok;
    } catch {
      setMessage("Could not reach Gillu. Check your connection and try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** Swaps positions with the neighbouring photo; the first is the cover. */
  async function move(index: number, direction: -1 | 1) {
    const image = images[index];
    const other = images[index + direction];
    if (!image || !other) {
      return;
    }
    const base = `/api/v1/merchant/products/${productId}/images`;
    const moved = await send(
      `${base}/${image.id}`,
      jsonPatch({ sortOrder: other.sortOrder }),
    );
    if (moved) {
      await send(
        `${base}/${other.id}`,
        jsonPatch({ sortOrder: image.sortOrder }),
      );
    }
  }

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMessage("Choose an image to upload.");
      return;
    }
    const form = new FormData();
    form.set("file", file);
    if (alt.trim()) {
      form.set("alt", alt.trim());
    }
    const uploaded = await send(
      `/api/v1/merchant/products/${productId}/images`,
      { body: form, method: "POST" },
    );
    if (uploaded && fileRef.current) {
      fileRef.current.value = "";
      setAlt("");
    }
  }

  return (
    <>
      {images.length > 0 ? (
        <ul className="product-images">
          {images.map((image, index) => (
            <li key={image.id}>
              <Image
                alt={image.alt}
                height={image.height}
                src={image.url}
                unoptimized
                width={image.width}
              />
              {readOnly ? (
                <span className="small muted">{image.alt}</span>
              ) : (
                <ImageControls
                  busy={busy}
                  image={image}
                  isFirst={index === 0}
                  isLast={index === images.length - 1}
                  onMove={(direction) => void move(index, direction)}
                  onRemove={() =>
                    void send(
                      `/api/v1/merchant/products/${productId}/images/${image.id}`,
                      { method: "DELETE" },
                    )
                  }
                  onSaveAlt={(alt) =>
                    send(
                      `/api/v1/merchant/products/${productId}/images/${image.id}`,
                      jsonPatch({ alt }),
                    )
                  }
                  position={index + 1}
                />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No photos yet. Products need one to publish.</p>
      )}
      {!readOnly && images.length < MAX_PRODUCT_IMAGES && (
        <form className="form-grid image-upload" noValidate onSubmit={upload}>
          <div className="field">
            <label htmlFor="imageFile">
              Photo (JPEG, PNG or WebP, up to 4 MB)
            </label>
            <input
              accept="image/jpeg,image/png,image/webp"
              id="imageFile"
              ref={fileRef}
              type="file"
            />
          </div>
          <div className="field">
            <label htmlFor="imageAlt">Describe the photo (optional)</label>
            <input
              id="imageAlt"
              maxLength={200}
              onChange={(event) => setAlt(event.target.value)}
              value={alt}
            />
          </div>
          <div className="full">
            <button className="button" disabled={busy} type="submit">
              Upload image
            </button>
          </div>
        </form>
      )}
      {message && (
        <p className="notice danger" role="alert">
          {message}
        </p>
      )}
    </>
  );
}

function ImageControls({
  busy,
  image,
  isFirst,
  isLast,
  onMove,
  onRemove,
  onSaveAlt,
  position,
}: {
  busy: boolean;
  image: ProductImageView;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onSaveAlt: (alt: string) => Promise<boolean>;
  position: number;
}) {
  const [alt, setAlt] = useState(image.alt);
  const id = `alt-${image.id}`;
  return (
    <>
      <label className="sr-only" htmlFor={id}>
        Description of photo {position}
      </label>
      <input
        className="image-alt"
        id={id}
        maxLength={200}
        onChange={(event) => setAlt(event.target.value)}
        value={alt}
      />
      <div className="row wrap">
        {alt.trim() !== image.alt && (
          <button
            aria-label={`Save description of photo ${position}`}
            className="text-button small"
            disabled={busy || !alt.trim()}
            onClick={() => void onSaveAlt(alt.trim())}
            type="button"
          >
            Save
          </button>
        )}
        {!isFirst && (
          <button
            aria-label={`Move photo ${position} earlier`}
            className="text-button small"
            disabled={busy}
            onClick={() => onMove(-1)}
            type="button"
          >
            ←
          </button>
        )}
        {!isLast && (
          <button
            aria-label={`Move photo ${position} later`}
            className="text-button small"
            disabled={busy}
            onClick={() => onMove(1)}
            type="button"
          >
            →
          </button>
        )}
        <button
          aria-label={`Remove photo ${position}`}
          className="text-button small"
          disabled={busy}
          onClick={onRemove}
          type="button"
        >
          Remove
        </button>
      </div>
      {isFirst && <span className="small muted">Cover photo</span>}
    </>
  );
}

function jsonPatch(body: unknown): RequestInit {
  return {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "PATCH",
  };
}
