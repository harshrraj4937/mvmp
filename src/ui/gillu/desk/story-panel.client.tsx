"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import type {
  MerchantStory,
  StoryImageView,
} from "~/modules/merchants/application/story";

import { type ApiError, fieldErrors, sendJson } from "~/lib/api-client";
import { MAX_STORY_IMAGES } from "~/modules/catalog/domain/constants";
import { INDIAN_STATES } from "~/modules/catalog/domain/indian-states";

const STORY_MAX = 3000;

/** "Your story": the shop's text, village or town, state and photos. */
export function StoryPanel({ story }: { story: MerchantStory }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(story.story ?? "");
  const [homePlace, setHomePlace] = useState(story.homePlace ?? "");
  const [homeState, setHomeState] = useState(story.homeState ?? "");
  const [alt, setAlt] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveStory(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const result = await sendJson("/api/v1/merchant/story", "PATCH", {
      homePlace,
      homeState,
      story: text,
    });
    setBusy(false);
    if (result.error) {
      setErrors(fieldErrors(result.error));
      setMessage(result.error.message);
      return;
    }
    setErrors({});
    setMessage("Story saved.");
    router.refresh();
  }

  /** Sends a request and refreshes the page when it succeeds. */
  async function send(path: string, init: RequestInit) {
    setBusy(true);
    setMessage("");
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

  /** Swaps positions with the neighbouring photo. */
  async function move(images: StoryImageView[], index: number, step: -1 | 1) {
    const image = images[index];
    const other = images[index + step];
    if (!image || !other) {
      return;
    }
    const base = "/api/v1/merchant/story/images";
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
      setMessage("Choose a photo to upload.");
      return;
    }
    const form = new FormData();
    form.set("file", file);
    if (alt.trim()) {
      form.set("alt", alt.trim());
    }
    const uploaded = await send("/api/v1/merchant/story/images", {
      body: form,
      method: "POST",
    });
    if (uploaded && fileRef.current) {
      fileRef.current.value = "";
      setAlt("");
    }
  }

  const images = story.images;
  return (
    <section className="panel story-panel" id="story">
      <h2>Your story</h2>
      <p className={story.complete ? "notice green" : "notice"} role="status">
        {story.complete
          ? "Your story is complete."
          : "Your story is not complete yet — shoppers will see it on your shop page."}
      </p>
      <form className="form-grid" noValidate onSubmit={saveStory}>
        <div className="field full">
          <label htmlFor="shopStory">Tell shoppers about your shop</label>
          <textarea
            aria-describedby={
              errors.story ? "shopStory-error" : "shopStory-hint"
            }
            aria-invalid={errors.story ? true : undefined}
            id="shopStory"
            maxLength={STORY_MAX}
            onChange={(event) => setText(event.target.value)}
            rows={6}
            value={text}
          />
          <p className="field-hint" id="shopStory-hint">
            At least 150 characters. {text.length} / {STORY_MAX}
          </p>
          {errors.story && (
            <p className="field-error" id="shopStory-error">
              {errors.story}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor="homePlace">Village or town</label>
          <input
            aria-describedby={errors.homePlace ? "homePlace-error" : undefined}
            aria-invalid={errors.homePlace ? true : undefined}
            id="homePlace"
            maxLength={60}
            onChange={(event) => setHomePlace(event.target.value)}
            value={homePlace}
          />
          {errors.homePlace && (
            <p className="field-error" id="homePlace-error">
              {errors.homePlace}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor="homeState">State</label>
          <select
            id="homeState"
            onChange={(event) => setHomeState(event.target.value)}
            value={homeState}
          >
            <option value="">Choose a state</option>
            {INDIAN_STATES.map((state) => (
              <option key={state.slug} value={state.slug}>
                {state.name}
              </option>
            ))}
          </select>
          {errors.homeState && (
            <p className="field-error">{errors.homeState}</p>
          )}
        </div>
        <div className="full">
          <button className="button" disabled={busy} type="submit">
            Save story
          </button>
        </div>
      </form>

      <h3>Photos of you at work</h3>
      {images.length > 0 ? (
        <ul className="product-images">
          {images.map((image, index) => (
            <StoryPhoto
              busy={busy}
              image={image}
              isFirst={index === 0}
              isLast={index === images.length - 1}
              key={image.id}
              onMove={(step) => void move(images, index, step)}
              onRemove={() =>
                void send(`/api/v1/merchant/story/images/${image.id}`, {
                  method: "DELETE",
                })
              }
              onSaveAlt={(value) =>
                send(
                  `/api/v1/merchant/story/images/${image.id}`,
                  jsonPatch({ alt: value }),
                )
              }
              position={index + 1}
            />
          ))}
        </ul>
      ) : (
        <p className="muted">
          No photos yet. Shoppers see them on your shop page.
        </p>
      )}
      {images.length < MAX_STORY_IMAGES && (
        <form className="form-grid image-upload" noValidate onSubmit={upload}>
          <div className="field">
            <label htmlFor="storyImageFile">
              Photo (JPEG, PNG or WebP, up to 4 MB)
            </label>
            <input
              accept="image/jpeg,image/png,image/webp"
              id="storyImageFile"
              ref={fileRef}
              type="file"
            />
          </div>
          <div className="field">
            <label htmlFor="storyImageAlt">Describe the photo (optional)</label>
            <input
              id="storyImageAlt"
              maxLength={200}
              onChange={(event) => setAlt(event.target.value)}
              value={alt}
            />
          </div>
          <div className="full">
            <button className="button" disabled={busy} type="submit">
              Upload photo
            </button>
          </div>
        </form>
      )}
      {message && (
        <p className="notice danger" role="alert">
          {message}
        </p>
      )}
    </section>
  );
}

function jsonPatch(body: unknown): RequestInit {
  return {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "PATCH",
  };
}

function StoryPhoto({
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
  image: StoryImageView;
  isFirst: boolean;
  isLast: boolean;
  onMove: (step: -1 | 1) => void;
  onRemove: () => void;
  onSaveAlt: (alt: string) => Promise<boolean>;
  position: number;
}) {
  const [alt, setAlt] = useState(image.alt);
  const id = `story-alt-${image.id}`;
  return (
    <li>
      <Image
        alt={image.alt}
        height={image.height}
        src={image.url}
        unoptimized
        width={image.width}
      />
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
    </li>
  );
}
