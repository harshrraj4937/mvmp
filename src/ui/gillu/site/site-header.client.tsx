"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { CartButton } from "../store/cart-button.client";
import { SITE_NAV } from "./content";
import { SiteIcon } from "./site-icons";

const MOBILE_NAV = [
  ...SITE_NAV,
  { href: "#sell", label: "Sell on Gillu" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
  };

  return (
    <header className="site-header">
      <div className="header-inner container">
        <Link aria-label="Gillu home" className="brand" href="/">
          <SiteIcon className="brand-icon" name="squirrel" />
          <span>
            gillu<span className="brand-dot">.</span>
          </span>
        </Link>
        <nav aria-label="Main navigation" className="desktop-nav">
          {SITE_NAV.map((item) => (
            <a href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
          <Link href="/auth/sign-in">Sign in</Link>
        </nav>
        <CartButton />
        <a className="seller-nav" href="#sell">
          Sell on Gillu <SiteIcon className="icon" name="arrow-up" />
        </a>
        <button
          aria-controls="mobile-nav"
          aria-expanded={open}
          aria-label={open ? "Close navigation" : "Open navigation"}
          className="menu-toggle"
          onClick={() => {
            setOpen(!open);
          }}
          ref={toggleRef}
          type="button"
        >
          <span />
          <span />
        </button>
      </div>
      <nav
        aria-label="Mobile navigation"
        className="mobile-nav"
        hidden={!open}
        id="mobile-nav"
      >
        {MOBILE_NAV.map((item) => (
          <a href={item.href} key={item.href} onClick={close}>
            {item.label}
          </a>
        ))}
        <Link href="/auth/sign-in" onClick={close}>
          Sign in
        </Link>
      </nav>
    </header>
  );
}
