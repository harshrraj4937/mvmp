"use client";

import type React from "react";

import { useEffect, useId, useRef } from "react";

import { Icon } from "./icon";

/**
 * Desk dialog (source `#modal`): a native modal <dialog> with a heading and
 * a close button. Children mount only while open, so forms start fresh.
 * Escape, the close button and a click on the backdrop call `onClose`.
 */
export function Modal({
  children,
  onClose,
  open,
  subtitle,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  open: boolean;
  subtitle?: string;
  title: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) {
      dialog.showModal();
    }
    if (!open && dialog?.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      aria-labelledby={titleId}
      className="modal"
      onClose={onClose}
      onPointerDown={(event) => {
        // A press on the backdrop lands on the dialog element itself.
        if (event.target === event.currentTarget) {
          const box = event.currentTarget.getBoundingClientRect();
          const outside =
            event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom;
          if (outside) {
            onClose();
          }
        }
      }}
      ref={ref}
    >
      {open && (
        <>
          <div className="modal-head">
            <div>
              <h2 id={titleId}>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
            <button
              aria-label="Close dialog"
              className="icon-button"
              onClick={onClose}
              type="button"
            >
              <Icon name="close" />
            </button>
          </div>
          <div className="modal-body">{children}</div>
        </>
      )}
    </dialog>
  );
}
