"use client";

import { SiteIcon } from "./site-icons";
import { useSite } from "./site-shell.client";

export function EarlyAccess() {
  const { openDialog } = useSite();
  return (
    <section
      aria-labelledby="early-title"
      className="early-access section container"
      id="early-access"
    >
      <SiteIcon className="early-flower" name="flower" />
      <p className="eyebrow">GOOD THINGS ARE ON THEIR WAY</p>
      <h2 id="early-title">
        Your next favourite find
        <br />
        is <em>closer than you think.</em>
      </h2>
      <p>
        We&apos;re bringing the first Gillu collections together.
        <br />A little taste of home. A whole lot to look forward to.
      </p>
      <button
        className="button primary"
        onClick={() => {
          openDialog(<EarlyAccessDialog />);
        }}
        type="button"
      >
        Be part of the beginning <SiteIcon className="icon" name="arrow-up" />
      </button>
      <span className="launch-note">Pre-launch · Early access opens soon</span>
    </section>
  );
}

function EarlyAccessDialog() {
  const { closeDialog, showCollection } = useSite();
  return (
    <div className="dialog-content">
      <p className="eyebrow">GOOD THINGS TAKE A LITTLE TIME</p>
      <h2 id="dialog-title">
        You&apos;re here
        <br />
        at the beginning.
      </h2>
      <p>
        We’re putting together Gillu’s first collections and getting to know the
        makers behind them.
      </p>
      <div className="dialog-notice">
        <strong>Early access opens soon.</strong>
        <br />
        Sign-ups are not open yet. No contact information is being collected.
      </div>
      <p>
        For now, explore the collection previews and discover the traditions
        inspiring them.
      </p>
      <button
        className="button primary"
        onClick={() => {
          closeDialog();
          showCollection();
        }}
        type="button"
      >
        Explore the previews <SiteIcon className="icon" name="arrow" />
      </button>
    </div>
  );
}
