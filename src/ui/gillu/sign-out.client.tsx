"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { signOut } from "~/lib/auth-client";

/** Signs out and returns to the home page. */
export function SignOutButton({
  className,
  onDone,
}: {
  className?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await signOut();
          onDone?.();
          router.push("/");
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      type="button"
    >
      Sign out
    </button>
  );
}
