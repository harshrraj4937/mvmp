"use client";

import { useEffect, useRef } from "react";

import { Icon } from "./icon";

/** Product search in the topbar; `/` focuses it from anywhere on the page. */
export function DeskSearch() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.isContentEditable ||
        ["INPUT", "SELECT", "TEXTAREA"].includes(target?.tagName ?? "");
      if (
        event.key !== "/" ||
        typing ||
        document.querySelector("dialog[open]")
      ) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <form action="/merchant/products" className="global-search" role="search">
      <Icon name="search" />
      <input
        aria-label="Search products"
        name="q"
        placeholder="Search products…"
        ref={inputRef}
        type="search"
      />
      <kbd>/</kbd>
    </form>
  );
}
