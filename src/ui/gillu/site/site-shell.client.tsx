"use client";

import type React from "react";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { CollectionFilter } from "./content";

interface SiteContextValue {
  closeDialog: () => void;
  filter: CollectionFilter;
  /** Shows `content` in the page's single detail dialog. */
  openDialog: (content: React.ReactNode) => void;
  setFilter: (filter: CollectionFilter) => void;
  /** Resets the filter and scrolls to the collection. */
  showCollection: () => void;
}

const SiteContext = createContext<null | SiteContextValue>(null);

/**
 * Root of the Gillu site (`.gillu-site`, which scopes its CSS). Owns the
 * detail dialog: it opens modally, closes on Escape, the close button or a
 * backdrop click, and returns focus to whatever opened it.
 */
export function SiteShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);
  const [content, setContent] = useState<React.ReactNode>(null);
  const [filter, setFilter] = useState<CollectionFilter>("all");

  const openDialog = useCallback((next: React.ReactNode) => {
    openerRef.current = document.activeElement;
    setContent(next);
  }, []);

  const closeDialog = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (content && dialog && !dialog.open) {
      dialog.showModal();
      closeRef.current?.focus();
    }
  }, [content]);

  const showCollection = useCallback(() => {
    setFilter("all");
    document
      .getElementById("discover")
      ?.scrollIntoView({ behavior: scrollBehavior() });
  }, []);

  const value = useMemo(
    () => ({ closeDialog, filter, openDialog, setFilter, showCollection }),
    [closeDialog, filter, openDialog, showCollection],
  );

  return (
    <SiteContext value={value}>
      <div
        className={`
          gillu-site
          ${content ? "dialog-open" : ""}
          ${className}
        `}
      >
        {children}
        <dialog
          aria-labelledby="dialog-title"
          id="detail-dialog"
          onClick={(event) => {
            const dialog = event.currentTarget;
            if (event.target !== dialog) {
              return;
            }
            const bounds = dialog.getBoundingClientRect();
            const outside =
              event.clientX < bounds.left ||
              event.clientX > bounds.right ||
              event.clientY < bounds.top ||
              event.clientY > bounds.bottom;
            if (outside) {
              dialog.close();
            }
          }}
          onClose={() => {
            setContent(null);
            const opener = openerRef.current;
            if (opener instanceof HTMLElement && document.contains(opener)) {
              opener.focus();
            }
          }}
          ref={dialogRef}
        >
          <button
            aria-label="Close dialog"
            className="dialog-close"
            onClick={closeDialog}
            ref={closeRef}
            type="button"
          >
            ×
          </button>
          <div id="dialog-body">{content}</div>
        </dialog>
      </div>
    </SiteContext>
  );
}

export function useSite(): SiteContextValue {
  const value = use(SiteContext);
  if (!value) {
    throw new Error("useSite must be used inside <SiteShell>.");
  }
  return value;
}

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "instant"
    : "smooth";
}
