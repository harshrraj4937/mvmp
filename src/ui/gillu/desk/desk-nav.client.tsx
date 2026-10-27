"use client";

import type React from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import type { DeskIconName } from "./desk-icons";

import { DeskSearch } from "./desk-search.client";
import { Icon } from "./icon";

export interface DeskNavItem {
  href: string;
  icon: DeskIconName;
  label: string;
}

/** Breadcrumb names for desk pages that are not in the nav. */
const PAGE_NAMES: Record<string, string> = {
  "/merchant/onboarding": "Your shop",
};

/**
 * Sidebar, topbar and the off-canvas menu used below 760px. Client-side only
 * for the menu state and the active link; the items come from the server.
 */
export function DeskFrame({
  children,
  items,
  merchant,
  search,
}: {
  children: React.ReactNode;
  items: DeskNavItem[];
  merchant: null | { initials: string; storeName: string };
  search: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = items.find((item) => isActive(pathname, item.href));
  const pageName = current?.label ?? PAGE_NAMES[pathname] ?? "Merchant desk";

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
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
    <>
      <div className="nav-scrim" hidden={!open} onClick={close} />
      <aside className={open ? "sidebar open" : "sidebar"} id="sidebar">
        <Link
          aria-label="Gillu merchant desk"
          className="brand"
          href={merchant ? (items[0]?.href ?? "/merchant") : "/"}
          onClick={close}
        >
          <Icon className="" name="squirrel" />
          <span>
            gillu<span className="brand-dot">.</span>
          </span>
          <small>MERCHANT DESK</small>
        </Link>
        {merchant && (
          <>
            <div className="merchant-select">
              <span className="store-avatar">{merchant.initials}</span>
              <div>
                <span className="merchant-select-label">YOUR STORE</span>
                <span className="merchant-select-name">
                  {merchant.storeName}
                </span>
              </div>
            </div>
            <p className="nav-label">YOUR WORKSPACE</p>
            <nav aria-label="Merchant navigation">
              {items.map((item) => {
                const active = item === current;
                return (
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={active ? "nav-link active" : "nav-link"}
                    href={item.href}
                    key={item.href}
                    onClick={close}
                  >
                    <Icon name={item.icon} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </>
        )}
        <div className="sidebar-bottom">
          <p className="sidebar-note">Local roots. Everyday joy.</p>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            aria-controls="sidebar"
            aria-expanded={open}
            aria-label="Open navigation"
            className="icon-button mobile-menu"
            onClick={() => {
              setOpen(!open);
            }}
            type="button"
          >
            <Icon name="menu" />
          </button>
          <p className="breadcrumb">
            Merchant workspace <span>/</span> <strong>{pageName}</strong>
          </p>
          {search ? <DeskSearch /> : <span className="topbar-spacer" />}
          {merchant && (
            <Link
              aria-label="Open store profile"
              className="profile-button"
              href="/merchant/profile"
            >
              {merchant.initials}
            </Link>
          )}
        </header>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <footer className="workspace-footer">
          <span>Made for the hands behind the handmade.</span>
          <span>
            Gillu Merchant Desk <b>·</b> Local roots. Everyday joy.
          </span>
        </footer>
      </div>
    </>
  );
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
