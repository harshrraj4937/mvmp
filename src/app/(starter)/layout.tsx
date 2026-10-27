import type React from "react";

import { Footer } from "~/ui/components/footer";
import { Header } from "~/ui/components/header/header";

/** Starter pages (auth, admin, account, legacy catalog) keep their look. */
export default function StarterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`
        min-h-screen bg-gradient-to-br from-white to-slate-100 text-neutral-900
        selection:bg-primary/80
        dark:from-neutral-950 dark:to-neutral-900 dark:text-neutral-100
      `}
    >
      <Header showAuth={true} />
      <main className="flex min-h-screen flex-col">{children}</main>
      <Footer />
    </div>
  );
}
