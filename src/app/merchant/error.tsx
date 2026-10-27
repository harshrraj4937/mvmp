"use client";

import { Icon } from "~/ui/gillu/desk/icon";

/** Desk error state with retry. The cause stays in the server log. */
export default function MerchantError({ retry }: { retry: () => void }) {
  return (
    <div className="panel empty" role="alert">
      <div className="empty-symbol">
        <Icon name="alert" />
      </div>
      <h2>Something went wrong.</h2>
      <p>This page could not load. Your shop data is safe; try again.</p>
      <button className="button primary" onClick={retry} type="button">
        <Icon name="reset" />
        Try again
      </button>
    </div>
  );
}
